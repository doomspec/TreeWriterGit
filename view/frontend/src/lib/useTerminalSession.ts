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

export type TerminalConnectionState = "connecting" | "connected" | "closed" | "idle";

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
    let lastCols = 0;
    let lastRows = 0;
    setConnectionState("connecting");

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
    const { sessionId, forceNew } = terminalConnectRef.current;
    const socket = new WebSocket(buildTerminalWebSocketUrl(terminalUrl, { sessionId, forceNew }));
    terminalConnectRef.current = { sessionId: loadTerminalSessionId(), forceNew: false };

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    socketRef.current = socket;

    terminal.loadAddon(fitAddon);

    let resizeObserver: ResizeObserver | null = null;
    let dataDisposable: { dispose: () => void } | null = null;

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
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
        }
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
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "input", data }));
        }
      });
    }, 0);

    socket.addEventListener("open", () => {
      if (!active) return;
      setConnectionState("connected");
      sendResize();
    });
    socket.addEventListener("message", (event) => {
      if (!active || typeof event.data !== "string") return;
      const sessionIdFromServer = parseTerminalSessionMessage(event.data);
      if (sessionIdFromServer) {
        saveTerminalSessionId(sessionIdFromServer);
        return;
      }
      terminal.write(event.data);
    });
    socket.addEventListener("close", () => {
      if (!active) return;
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal disconnected]");
    });
    socket.addEventListener("error", () => {
      if (!active) return;
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal websocket error]");
    });

    return () => {
      active = false;
      if (resizeRaf !== undefined) window.cancelAnimationFrame(resizeRaf);
      window.clearTimeout(openTimer);
      resizeObserver?.disconnect();
      dataDisposable?.dispose();
      closeWebSocket(socket);
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
