import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { WebSocket } from "ws";

export type TerminalSessionConfig = {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

export type TerminalSession = {
  id: string;
  term: ChildProcessWithoutNullStreams;
  controlFd: NodeJS.WritableStream | null;
  scrollback: string;
  socket: WebSocket | null;
};

const MAX_SCROLLBACK = 512 * 1024;
const WS_OPEN = 1;

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

  function broadcast(session: TerminalSession, data: string) {
    appendScrollback(session, data);
    if (session.socket?.readyState === WS_OPEN) {
      session.socket.send(data);
    }
  }

  function spawnSession(id: string): TerminalSession {
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
      socket: null,
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

  function attach(socket: WebSocket, session: TerminalSession) {
    session.socket = socket;
    socket.send(JSON.stringify({ type: "session", id: session.id }));
    if (session.scrollback) {
      socket.send(session.scrollback);
    }
  }

  function detach(session: TerminalSession) {
    session.socket = null;
  }

  function handleInput(session: TerminalSession, data: string) {
    session.term.stdin.write(data);
  }

  function handleResize(session: TerminalSession, cols: number, rows: number) {
    if (session.controlFd && Number.isFinite(cols) && Number.isFinite(rows)) {
      session.controlFd.write(`${JSON.stringify({ t: "resize", cols, rows })}\n`);
    }
  }

  return {
    resolveSession,
    attach,
    detach,
    destroySession,
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
} {
  const parsed = new URL(url, "http://localhost");
  return {
    sessionId: parsed.searchParams.get("session"),
    forceNew: parsed.searchParams.get("new") === "1",
  };
}
