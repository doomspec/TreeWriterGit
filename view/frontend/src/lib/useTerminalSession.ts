import { useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import {
  buildTerminalWebSocketUrl,
  clearTerminalSessionId,
  loadTerminalSessionId,
  parseTerminalSessionMessage,
  saveTerminalSessionId,
} from "@/lib/terminalSession";

const terminalUrl = import.meta.env.VITE_TERMINAL_WS_URL ?? "ws://localhost:4000/terminal";

export type TerminalConnectionState = "connecting" | "connected" | "closed";

type UseTerminalSessionOptions = {
  refitTriggers?: unknown[];
};

export function useTerminalSession(options: UseTerminalSessionOptions = {}) {
  const { refitTriggers = [] } = options;
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const terminalConnectRef = useRef<{ sessionId: string | null; forceNew: boolean }>({
    sessionId: loadTerminalSessionId(),
    forceNew: false,
  });

  const [connectionState, setConnectionState] = useState<TerminalConnectionState>("connecting");
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (!terminalElementRef.current) return;

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
    terminal.open(terminalElementRef.current);
    fitAddon.fit();

    const sendResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
      }
    };

    const resizeObserver = new ResizeObserver(sendResize);
    resizeObserver.observe(terminalElementRef.current);

    const dataDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    socket.addEventListener("open", () => {
      setConnectionState("connected");
      sendResize();
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const sessionIdFromServer = parseTerminalSessionMessage(event.data);
      if (sessionIdFromServer) {
        saveTerminalSessionId(sessionIdFromServer);
        return;
      }
      terminal.write(event.data);
    });
    socket.addEventListener("close", () => {
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal disconnected]");
    });
    socket.addEventListener("error", () => {
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal websocket error]");
    });

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      socket.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      socketRef.current = null;
    };
  }, [sessionKey]);

  const refitTerminal = useCallback(() => {
    window.requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
      const terminal = terminalRef.current;
      const socket = socketRef.current;
      if (terminal && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
      }
    });
  }, []);

  useEffect(() => {
    refitTerminal();
    const onResize = () => refitTerminal();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refitTriggers are caller-supplied layout deps
  }, [refitTerminal, sessionKey, ...refitTriggers]);

  const sendToTerminal = useCallback((command: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", data: command }));
    }
  }, []);

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
    terminalElementRef,
    terminalConnectRef,
    connectionState,
    sessionKey,
    setSessionKey,
    sendToTerminal,
    refitTerminal,
    reconnectTerminal,
  };
}
