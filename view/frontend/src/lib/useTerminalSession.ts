import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import {
  buildTerminalWebSocketUrl,
  clearTerminalSessionId,
  loadTerminalSessionId,
  parseTerminalSessionMessage,
  saveTerminalSessionId,
} from "@/lib/terminalSession";

import { closeWebSocket } from "@/lib/websocket";

const terminalUrl = import.meta.env.VITE_TERMINAL_WS_URL ?? "ws://localhost:4000/terminal";
const MAX_RECONNECT_MS = 30_000;
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 12;

export type TerminalConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "server_lost"
  | "idle";

type UseTerminalSessionOptions = {
  refitTriggers?: unknown[];
  /** When false, xterm and websocket stay torn down (panel closed). */
  enabled?: boolean;
};

export function useTerminalSession(options: UseTerminalSessionOptions = {}) {
  const { refitTriggers = [], enabled = true } = options;
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const terminalConnectRef = useRef<{ sessionId: string | null; forceNew: boolean }>({
    sessionId: loadTerminalSessionId(),
    forceNew: false,
  });
  const manualCloseRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  const [connectionState, setConnectionState] = useState<TerminalConnectionState>(
    enabled ? "connecting" : "idle",
  );
  const [sessionKey, setSessionKey] = useState(0);

  const terminalHostRef = useCallback((node: HTMLDivElement | null) => {
    terminalElementRef.current = node;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnectionState("idle");
      return;
    }
    if (!terminalElementRef.current) return;

    let active = true;
    let resizeRaf: number | undefined;
    let reconnectTimer: number | undefined;
    let lastCols = 0;
    let lastRows = 0;
    manualCloseRef.current = false;
    reconnectAttemptRef.current = 0;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 11,
      lineHeight: 1.3,
      theme: {
        background: "#0f1113",
        foreground: "#e8eaed",
        cursor: "#ffffff",
        selectionBackground: "#3b4754",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    let resizeObserver: ResizeObserver | null = null;
    let dataDisposable: { dispose: () => void } | null = null;
    let socket: WebSocket | null = null;

    const sendResize = () => {
      if (!active || resizeRaf !== undefined) return;
      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = undefined;
        if (!active) return;
        try {
          fitAddon.fit();
        } catch {
          return;
        }
        if (terminal.cols === lastCols && terminal.rows === lastRows) return;
        lastCols = terminal.cols;
        lastRows = terminal.rows;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
        }
      });
    };

    const scheduleReconnect = () => {
      if (!active || manualCloseRef.current) return;
      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionState("server_lost");
        terminal.writeln("\r\n[terminal server unavailable — click Reconnect]");
        return;
      }
      const delay = Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * 2 ** reconnectAttemptRef.current);
      reconnectAttemptRef.current += 1;
      setConnectionState("reconnecting");
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const connect = () => {
      if (!active || manualCloseRef.current) return;
      if (socket) {
        closeWebSocket(socket);
        socket = null;
        socketRef.current = null;
      }

      const isFirstConnect = reconnectAttemptRef.current === 0;
      setConnectionState(isFirstConnect ? "connecting" : "reconnecting");

      const { sessionId, forceNew } = terminalConnectRef.current;
      const nextSocket = new WebSocket(buildTerminalWebSocketUrl(terminalUrl, { sessionId, forceNew }));
      terminalConnectRef.current = { sessionId: loadTerminalSessionId(), forceNew: false };
      socket = nextSocket;
      socketRef.current = nextSocket;

      nextSocket.addEventListener("open", () => {
        if (!active || socket !== nextSocket) return;
        reconnectAttemptRef.current = 0;
        setConnectionState("connected");
        sendResize();
      });

      nextSocket.addEventListener("message", (event) => {
        if (!active || socket !== nextSocket || typeof event.data !== "string") return;
        const sessionIdFromServer = parseTerminalSessionMessage(event.data);
        if (sessionIdFromServer) {
          saveTerminalSessionId(sessionIdFromServer);
          return;
        }
        terminal.write(event.data);
      });

      nextSocket.addEventListener("close", () => {
        if (!active || socket !== nextSocket) return;
        socket = null;
        socketRef.current = null;
        if (manualCloseRef.current) {
          setConnectionState("closed");
          return;
        }
        terminal.writeln("\r\n[terminal disconnected — reconnecting…]");
        scheduleReconnect();
      });

      nextSocket.addEventListener("error", () => {
        if (!active || socket !== nextSocket) return;
        closeWebSocket(nextSocket);
      });
    };

    const openTimer = window.setTimeout(() => {
      const mount = terminalElementRef.current;
      if (!active || !mount) return;

      terminal.open(mount);
      sendResize();

      resizeObserver = new ResizeObserver(sendResize);
      resizeObserver.observe(mount);

      dataDisposable = terminal.onData((data) => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "input", data }));
        }
      });

      connect();
    }, 0);

    return () => {
      active = false;
      manualCloseRef.current = true;
      if (resizeRaf !== undefined) window.cancelAnimationFrame(resizeRaf);
      window.clearTimeout(openTimer);
      window.clearTimeout(reconnectTimer);
      resizeObserver?.disconnect();
      dataDisposable?.dispose();
      if (socket) closeWebSocket(socket);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      socketRef.current = null;
    };
  }, [sessionKey, enabled]);

  const refitTerminal = useCallback(() => {
    if (!enabled) return;
    window.requestAnimationFrame(() => {
      const fitAddon = fitAddonRef.current;
      const terminal = terminalRef.current;
      const socket = socketRef.current;
      if (!fitAddon || !terminal) return;
      try {
        fitAddon.fit();
      } catch {
        return;
      }
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
      }
    });
  }, [enabled]);

  const refitTriggerKey = useMemo(() => JSON.stringify(refitTriggers), [refitTriggers]);

  useEffect(() => {
    if (!enabled) return;
    refitTerminal();
    const onResize = () => refitTerminal();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [refitTerminal, sessionKey, enabled, refitTriggerKey]);

  const sendToTerminal = useCallback((command: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", data: command }));
    }
  }, []);

  const waitForTerminalReady = useCallback((timeoutMs = 8000) => {
    return new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          reject(new Error("Terminal not connected — open the bottom panel and retry"));
          return;
        }
        window.setTimeout(poll, 50);
      };
      poll();
    });
  }, []);

  const sendToTerminalWhenReady = useCallback(
    async (command: string) => {
      await waitForTerminalReady();
      sendToTerminal(command);
    },
    [sendToTerminal, waitForTerminalReady],
  );

  const reconnectTerminal = useCallback(() => {
    const previousSessionId = loadTerminalSessionId();
    clearTerminalSessionId();
    terminalConnectRef.current = {
      sessionId: previousSessionId,
      forceNew: true,
    };
    reconnectAttemptRef.current = 0;
    setSessionKey((k) => k + 1);
  }, []);

  return {
    terminalHostRef,
    terminalConnectRef,
    connectionState,
    sessionKey,
    setSessionKey,
    sendToTerminal,
    sendToTerminalWhenReady,
    waitForTerminalReady,
    refitTerminal,
    reconnectTerminal,
  };
}
