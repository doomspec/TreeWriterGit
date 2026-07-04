import { useCallback, useRef, useState } from "react";

import {
  addChatSessionContextFiles,
  appendChatTurn,
  createChatSession,
  type ChatSessionFile,
  type ChatTurn,
} from "@/lib/aiChat/sessionClient";
import { runBridgedTurn } from "@/lib/aiChat/bridgedChatClient";
import { isBridgedProvider, type BridgedProvider } from "@/lib/aiChat/providers";
import { isBridgedResumeError } from "@/lib/aiChat/resumeErrors";
import { getGitHubHandle } from "@/lib/userIdentity";

/**
 * Bridged chat mode (plans/ai-assistant-panel.md, Stage 6 — pulled forward):
 * per-turn headless calls to a known agent CLI via the backend, with session
 * resume, instead of scraping the interactive terminal. Used for known
 * providers where a full-screen TUI would otherwise be unreadable through
 * the PTY lens (see usePtyChatSession).
 */

export type BridgedChatStatus = "idle" | "attaching" | "attached" | "sending" | "error";

const NO_AGENT_SESSION_NOTICE =
  "No provider session id on record — the next message starts a fresh CLI session but prior turns are shown above.";
const EXPIRED_SESSION_NOTICE =
  "Provider session expired — continuing with a fresh CLI session. Prior turns are shown above.";

export function useBridgedChatSession(options: {
  unitPath: string;
  onError?: (message: string) => void;
}) {
  const { unitPath, onError } = options;
  const [status, setStatus] = useState<BridgedChatStatus>("idle");
  const [provider, setProvider] = useState<BridgedProvider | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const providerRef = useRef<BridgedProvider | null>(null);
  const agentSessionIdRef = useRef<string | null>(null);
  const traceSessionRef = useRef<{ filename: string } | null>(null);
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

  /** Create the repo trace lazily, once the CLI's own session id (if any) is known. */
  const ensureTraceSession = useCallback(
    async (chosenProvider: BridgedProvider) => {
      if (traceSessionRef.current) return traceSessionRef.current;
      const created = await createChatSession(unitPath, {
        provider: chosenProvider,
        mode: "bridged",
        agentSessionId: agentSessionIdRef.current ?? undefined,
      });
      traceSessionRef.current = { filename: created.filename };
      return traceSessionRef.current;
    },
    [unitPath],
  );

  const attach = useCallback((chosenProvider: BridgedProvider) => {
    providerRef.current = chosenProvider;
    agentSessionIdRef.current = null;
    traceSessionRef.current = null;
    setResumeNotice(null);
    setProvider(chosenProvider);
    setTurns([]);
    setStatus("attached");
  }, []);

  const resume = useCallback((session: ChatSessionFile): boolean => {
    if (session.mode !== "bridged" || !isBridgedProvider(session.provider)) {
      onErrorRef.current?.("Only bridged sessions can be resumed from history.");
      return false;
    }

    providerRef.current = session.provider;
    agentSessionIdRef.current = session.agentSessionId ?? null;
    traceSessionRef.current = { filename: session.filename };
    setProvider(session.provider);
    setTurns(session.turns);
    setResumeNotice(session.agentSessionId ? null : NO_AGENT_SESSION_NOTICE);
    setStatus("attached");
    return true;
  }, []);

  const runTurn = useCallback(
    async (
      chosenProvider: BridgedProvider,
      trimmed: string,
      contextPaths?: string[],
    ): Promise<{ text: string; sessionId: string | null }> => {
      try {
        return await runBridgedTurn(
          chosenProvider,
          trimmed,
          agentSessionIdRef.current,
          contextPaths,
          unitPath,
          getGitHubHandle() || undefined,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!agentSessionIdRef.current || !isBridgedResumeError(message)) {
          throw err;
        }
        agentSessionIdRef.current = null;
        setResumeNotice(EXPIRED_SESSION_NOTICE);
        return runBridgedTurn(
          chosenProvider,
          trimmed,
          null,
          contextPaths,
          unitPath,
          getGitHubHandle() || undefined,
        );
      }
    },
    [unitPath],
  );

  const send = useCallback(
    async (text: string, contextPaths?: string[]) => {
      const trimmed = text.trim();
      const chosenProvider = providerRef.current;
      if (!trimmed || !chosenProvider || status === "sending") return;

      const userTurn: ChatTurn = { role: "user", text: trimmed, at: new Date().toISOString() };
      setTurns((prev) => [...prev, userTurn]);
      setStatus("sending");

      try {
        const result = await runTurn(chosenProvider, trimmed, contextPaths);
        agentSessionIdRef.current = result.sessionId ?? agentSessionIdRef.current;
        const session = await ensureTraceSession(chosenProvider);
        persistTurn(session.filename, userTurn);
        if (contextPaths?.length) {
          void addChatSessionContextFiles(unitPath, session.filename, contextPaths).catch((err) =>
            onErrorRef.current?.(err instanceof Error ? err.message : String(err)),
          );
        }

        const assistantTurn: ChatTurn = {
          role: "assistant",
          text: result.text || "(no reply)",
          at: new Date().toISOString(),
        };
        setTurns((prev) => [...prev, assistantTurn]);
        persistTurn(session.filename, assistantTurn);
        setStatus("attached");
      } catch (err) {
        setStatus("error");
        onErrorRef.current?.(err instanceof Error ? err.message : String(err));
      }
    },
    [ensureTraceSession, persistTurn, runTurn, status],
  );

  const stop = useCallback(() => {
    // A bridged turn is a single blocking request-response; there is no
    // partial output to interrupt client-side. No-op kept for interface
    // parity with the PTY session.
  }, []);

  const detach = useCallback(() => {
    providerRef.current = null;
    agentSessionIdRef.current = null;
    traceSessionRef.current = null;
    setResumeNotice(null);
    setProvider(null);
    setTurns([]);
    setStatus("idle");
  }, []);

  const clearResumeNotice = useCallback(() => {
    setResumeNotice(null);
  }, []);

  return {
    status,
    provider: provider ?? "unknown",
    turns,
    pendingText: status === "sending" ? "…" : "",
    resumeNotice,
    attach,
    resume,
    send,
    stop,
    detach,
    clearResumeNotice,
  };
}
