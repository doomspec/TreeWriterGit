import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { WebSocket } from "ws";

import { clampTerminalSize } from "./terminalMessages.js";

export type TerminalSessionConfig = {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Kill detached sessions after this many ms (default 30 min). */
  idleTtlMs?: number;
  /** Max concurrent PTY sessions (default 8). */
  maxSessions?: number;
};

export type TerminalSession = {
  id: string;
  term: ChildProcessWithoutNullStreams;
  controlFd: NodeJS.WritableStream | null;
  scrollback: string;
  /** Scrollback bytes already shown in the connected client's xterm buffer. */
  deliveredScrollbackLength: number;
  socket: WebSocket | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

const MAX_SCROLLBACK = 512 * 1024;
const WS_OPEN = 1;
const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 8;

function appendScrollback(session: TerminalSession, chunk: string) {
  session.scrollback += chunk;
  if (session.scrollback.length > MAX_SCROLLBACK) {
    session.scrollback = session.scrollback.slice(-MAX_SCROLLBACK);
  }
}

function isAlive(session: TerminalSession): boolean {
  return session.term.exitCode === null && !session.term.killed;
}

function sanitizeShellNoise(text: string): string {
  return text
    .replace("bash: no job control in this shell\n", "")
    .replace(/\r?\nThe default interactive shell is now zsh\.[\s\S]*?HT208050\.\r?\n/, "");
}

export function createTerminalSessionManager(config: TerminalSessionConfig) {
  const sessions = new Map<string, TerminalSession>();
  const idleTtlMs = config.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
  const maxSessions = config.maxSessions ?? DEFAULT_MAX_SESSIONS;

  function clearIdleTimer(session: TerminalSession) {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }
  }

  function scheduleIdleDestroy(session: TerminalSession) {
    clearIdleTimer(session);
    session.idleTimer = setTimeout(() => {
      if (!session.socket && sessions.has(session.id)) {
        destroySession(session.id);
      }
    }, idleTtlMs);
  }

  function evictOldestDetachedSession() {
    for (const [id, session] of sessions) {
      if (!session.socket) {
        destroySession(id);
        return;
      }
    }
  }

  function broadcast(session: TerminalSession, data: string) {
    appendScrollback(session, data);
    if (session.socket?.readyState === WS_OPEN) {
      session.socket.send(data);
      session.deliveredScrollbackLength = session.scrollback.length;
    }
  }

  function spawnSession(id: string): TerminalSession {
    if (sessions.size >= maxSessions) {
      evictOldestDetachedSession();
    }
    if (sessions.size >= maxSessions) {
      throw new Error(`Maximum terminal sessions (${maxSessions}) reached`);
    }

    const term = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe", "pipe"],
    });

    const session: TerminalSession = {
      id,
      term,
      controlFd: term.stdio[3] as NodeJS.WritableStream | null,
      scrollback: "",
      deliveredScrollbackLength: 0,
      socket: null,
      idleTimer: null,
    };

    term.stdout.on("data", (data: Buffer) => {
      broadcast(session, data.toString());
    });

    term.stderr.on("data", (data: Buffer) => {
      const text = sanitizeShellNoise(data.toString());
      if (text) broadcast(session, text);
    });

    term.on("exit", (exitCode) => {
      const message = `\r\n[process exited with code ${exitCode ?? "unknown"}]\r\n`;
      broadcast(session, message);
      if (session.socket?.readyState === WS_OPEN) {
        session.socket.close();
      }
      sessions.delete(id);
    });

    term.on("error", (error) => {
      const message = `\r\n[failed to start shell: ${error.message}]\r\n`;
      broadcast(session, message);
      if (session.socket?.readyState === WS_OPEN) {
        session.socket.close();
      }
      sessions.delete(id);
    });

    sessions.set(id, session);
    return session;
  }

  function destroySession(id: string) {
    const session = sessions.get(id);
    if (!session) return;
    clearIdleTimer(session);
    session.term.kill();
    sessions.delete(id);
  }

  function resolveSession(requestedId: string | null, forceNew: boolean): TerminalSession {
    if (forceNew && requestedId) {
      destroySession(requestedId);
    }

    if (!forceNew && requestedId) {
      const existing = sessions.get(requestedId);
      if (existing && isAlive(existing)) {
        return existing;
      }
      if (existing) {
        sessions.delete(requestedId);
      }
      return spawnSession(requestedId);
    }

    return spawnSession(randomUUID());
  }

  function attach(
    socket: WebSocket,
    session: TerminalSession,
    options: { replayScrollback?: boolean } = {},
  ) {
    clearIdleTimer(session);
    session.socket = socket;
    socket.send(JSON.stringify({ type: "session", id: session.id }));

    const replayScrollback = options.replayScrollback !== false;
    if (replayScrollback) {
      if (session.scrollback) {
        socket.send(session.scrollback);
      }
    } else {
      const gap = session.scrollback.slice(session.deliveredScrollbackLength);
      if (gap) {
        socket.send(gap);
      }
    }
    session.deliveredScrollbackLength = session.scrollback.length;
  }

  function detach(session: TerminalSession) {
    session.socket = null;
    session.deliveredScrollbackLength = session.scrollback.length;
    scheduleIdleDestroy(session);
  }

  function handleInput(session: TerminalSession, data: string) {
    if (typeof data !== "string") return;
    session.term.stdin.write(data);
  }

  function handleResize(session: TerminalSession, cols: number, rows: number) {
    const size = clampTerminalSize(cols, rows);
    if (!size || !session.controlFd) return;
    session.controlFd.write(`${JSON.stringify({ t: "resize", cols: size.cols, rows: size.rows })}\n`);
  }

  function resetAllSessions() {
    for (const id of [...sessions.keys()]) {
      destroySession(id);
    }
  }

  return {
    resolveSession,
    attach,
    detach,
    destroySession,
    resetAllSessions,
    handleInput,
    handleResize,
    /** Test helper */
    _sessions: sessions,
  };
}

export type TerminalSessionManager = ReturnType<typeof createTerminalSessionManager>;

export function parseTerminalConnectParams(url: string): {
  sessionId: string | null;
  forceNew: boolean;
  replayScrollback: boolean;
} {
  const parsed = new URL(url, "http://localhost");
  return {
    sessionId: parsed.searchParams.get("session"),
    forceNew: parsed.searchParams.get("new") === "1",
    replayScrollback: parsed.searchParams.get("scrollback") !== "0",
  };
}
