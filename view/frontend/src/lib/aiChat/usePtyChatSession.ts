import { useCallback, useEffect, useRef, useState } from "react";

import {
  addChatSessionContextFiles,
  appendChatTurn,
  createChatSession,
  type ChatTurn,
} from "@/lib/aiChat/sessionClient";
import { stripAnsi } from "@/lib/aiChat/ansiStrip";
import { KNOWN_PROVIDERS } from "@/lib/aiChat/providers";

/**
 * PTY chat mode (plans/ai-assistant-panel.md, Stage 4): a chat lens over the
 * live terminal PTY. The user starts any agent CLI in the terminal, attaches
 * this session, and each subsequent message is typed into the terminal on
 * their behalf; the terminal's reply is captured, cleaned, and shown as an
 * assistant bubble. Every turn is persisted to a repo-versioned session file
 * as it happens.
 */

export type PtyChatStatus = "idle" | "attaching" | "attached" | "capturing" | "error";

const QUIET_MS = 800;
const CAPTURE_CAP_MS = 60_000;

function guessProviderFromLine(line: string): string | null {
  const match = /(?:^|\s)(claude|codex|gemini|hermes)\b/i.exec(line);
  return match ? match[1].toLowerCase() : null;
}

function cleanCapturedOutput(raw: string, sentText: string): string {
  const cleaned = stripAnsi(raw);
  const trimmedSent = sentText.trim();
  const lines = cleaned.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  // The PTY echoes back what we typed (often behind a "> " prompt prefix) —
  // drop that line so it isn't duplicated in the assistant bubble. sentText
  // can now be multi-line (a Context:/Files: block ahead of the message), and
  // a real terminal echoes each embedded line separately, so match and strip
  // one echoed line per sent line, in order, rather than only a single line.
  const sentLines = trimmedSent.split("\n").filter((line) => line.trim() !== "");
  let sentLineIndex = 0;
  while (sentLineIndex < sentLines.length && lines.length) {
    if (lines[0].trim() === "") {
      // A blank line between sent-text lines (e.g. around a Context:/Files:
      // block) echoes as a blank line too — skip it without consuming a
      // sentLine.
      lines.shift();
      continue;
    }
    if (lines[0].trim().endsWith(sentLines[sentLineIndex].trim())) {
      lines.shift();
      sentLineIndex += 1;
    } else {
      break;
    }
  }
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.join("\n").trim();
}

type Capture = {
  buffer: string;
  sentText: string;
  quietTimer: number | undefined;
  capTimer: number | undefined;
};

export function usePtyChatSession(options: {
  unitPath: string;
  connectionState: string;
  onSendToTerminal: (text: string) => void;
  subscribeOutput: (listener: (chunk: string) => void) => () => void;
  getTerminalSessionId: () => string | null;
  getLastInputLine: () => string;
  onError?: (message: string) => void;
  /** Called right before auto-launching a CLI, so the terminal can be shown. */
  onLaunchProvider?: () => void;
}) {
  const {
    unitPath,
    onSendToTerminal,
    subscribeOutput,
    getTerminalSessionId,
    getLastInputLine,
    onError,
    onLaunchProvider,
  } = options;
  const [status, setStatus] = useState<PtyChatStatus>("idle");
  const [provider, setProvider] = useState<string>("unknown");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingText, setPendingText] = useState("");

  const sessionRef = useRef<{ filename: string } | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const firstSendRef = useRef(true);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const persistTurn = useCallback(
    (filename: string, turn: ChatTurn) => {
      void appendChatTurn(unitPath, filename, turn).catch((err) =>
        onErrorRef.current?.(err instanceof Error ? err.message : String(err)),
      );
    },
    [unitPath],
  );

  const finalizeCapture = useCallback(() => {
    const capture = captureRef.current;
    if (!capture) return;
    window.clearTimeout(capture.quietTimer);
    window.clearTimeout(capture.capTimer);
    captureRef.current = null;
    setPendingText("");
    setStatus((prev) => (prev === "capturing" ? "attached" : prev));

    const cleaned = cleanCapturedOutput(capture.buffer, capture.sentText);
    if (!cleaned) return;
    const turn: ChatTurn = { role: "assistant", text: cleaned, at: new Date().toISOString() };
    setTurns((prev) => [...prev, turn]);
    const session = sessionRef.current;
    if (session) persistTurn(session.filename, turn);
  }, [persistTurn]);

  useEffect(() => {
    return subscribeOutput((chunk) => {
      const capture = captureRef.current;
      if (!capture) return;
      capture.buffer += chunk;
      setPendingText(cleanCapturedOutput(capture.buffer, capture.sentText));
      window.clearTimeout(capture.quietTimer);
      capture.quietTimer = window.setTimeout(finalizeCapture, QUIET_MS);
    });
  }, [subscribeOutput, finalizeCapture]);

  // Tear down any in-flight capture on unmount so timers don't leak.
  useEffect(() => {
    return () => {
      const capture = captureRef.current;
      if (capture) {
        window.clearTimeout(capture.quietTimer);
        window.clearTimeout(capture.capTimer);
      }
    };
  }, []);

  const attach = useCallback(
    async (chosenProvider?: string) => {
      setStatus("attaching");
      try {
        const alreadyRunning = guessProviderFromLine(getLastInputLine());
        const guessed = chosenProvider ?? alreadyRunning ?? "unknown";
        // The user picked a known CLI that doesn't look already running in
        // the terminal (nothing typed yet, or a different one) — launch it
        // for them instead of requiring a manual step first.
        if (
          (KNOWN_PROVIDERS as readonly string[]).includes(guessed) &&
          guessed !== alreadyRunning
        ) {
          onLaunchProvider?.();
          onSendToTerminal(`${guessed}\r`);
        }
        const created = await createChatSession(unitPath, {
          provider: guessed,
          mode: "pty",
          terminalSessionId: getTerminalSessionId() ?? undefined,
        });
        sessionRef.current = { filename: created.filename };
        firstSendRef.current = true;
        setProvider(guessed);
        setTurns([]);
        setStatus("attached");
      } catch (err) {
        setStatus("error");
        onErrorRef.current?.(err instanceof Error ? err.message : String(err));
      }
    },
    [getLastInputLine, getTerminalSessionId, onLaunchProvider, onSendToTerminal, unitPath],
  );

  const send = useCallback(
    (text: string, contextPaths?: string[]) => {
      const trimmed = text.trim();
      if (!trimmed || (status !== "attached" && status !== "capturing")) return;

      if (captureRef.current) finalizeCapture();

      // Tell the CLI which unit it's scoped to on the first message of the
      // session — otherwise it has to search the whole repo for the right
      // draft.md/outline.md before doing anything useful.
      const contextLine = firstSendRef.current
        ? `Context: you are working in the TreeWriter unit "${unitPath}" (paths below are relative to the model/ root).\n\n`
        : "";
      firstSendRef.current = false;
      const filesBlock = contextPaths?.length
        ? `Files:\n${contextPaths.map((p) => `@${p}`).join("\n")}\n\n`
        : "";
      const outgoing = `${contextLine}${filesBlock}${trimmed}`;

      const turn: ChatTurn = { role: "user", text: outgoing, at: new Date().toISOString() };
      setTurns((prev) => [...prev, turn]);
      const session = sessionRef.current;
      if (session) {
        persistTurn(session.filename, turn);
        if (contextPaths?.length) {
          void addChatSessionContextFiles(unitPath, session.filename, contextPaths).catch((err) =>
            onErrorRef.current?.(err instanceof Error ? err.message : String(err)),
          );
        }
      }

      captureRef.current = {
        buffer: "",
        sentText: outgoing,
        quietTimer: window.setTimeout(finalizeCapture, QUIET_MS),
        capTimer: window.setTimeout(finalizeCapture, CAPTURE_CAP_MS),
      };
      setStatus("capturing");
      onSendToTerminal(`${outgoing}\r`);
    },
    [status, finalizeCapture, onSendToTerminal, persistTurn, unitPath],
  );

  const stop = useCallback(() => {
    onSendToTerminal("");
    finalizeCapture();
  }, [finalizeCapture, onSendToTerminal]);

  const detach = useCallback(() => {
    if (captureRef.current) finalizeCapture();
    sessionRef.current = null;
    setTurns([]);
    setStatus("idle");
  }, [finalizeCapture]);

  return {
    status,
    provider,
    setProvider,
    turns,
    pendingText,
    attach,
    send,
    stop,
    detach,
    suggestedProvider: guessProviderFromLine(getLastInputLine()),
  };
}
