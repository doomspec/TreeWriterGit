import { useCallback, useMemo, useState } from "react";

import { usePtyChatSession, type PtyChatStatus } from "@/lib/aiChat/usePtyChatSession";
import { useBridgedChatSession, type BridgedChatStatus } from "@/lib/aiChat/useBridgedChatSession";
import { isBridgedProvider } from "@/lib/aiChat/providers";
import type { ChatSessionFile } from "@/lib/aiChat/sessionClient";

/**
 * Dispatches to bridged mode (known providers: claude/codex/gemini/hermes —
 * clean per-turn API calls) or PTY mode (anything else — a lens over the
 * live terminal). The choice is made once, at attach time, from the
 * provider the user picked. See plans/ai-assistant-panel.md.
 */
export function useAiChatSession(options: {
  unitPath: string;
  connectionState: string;
  onSendToTerminal: (text: string) => void;
  subscribeOutput: (listener: (chunk: string) => void) => () => void;
  getTerminalSessionId: () => string | null;
  getLastInputLine: () => string;
  onError?: (message: string) => void;
  onLaunchProvider?: () => void;
}) {
  const [mode, setMode] = useState<"pty" | "bridged" | null>(null);

  const pty = usePtyChatSession(options);
  const bridged = useBridgedChatSession({ unitPath: options.unitPath, onError: options.onError });

  const attach = useCallback(
    (chosenProvider?: string) => {
      if (chosenProvider && isBridgedProvider(chosenProvider)) {
        setMode("bridged");
        bridged.attach(chosenProvider);
        return Promise.resolve();
      }
      setMode("pty");
      return pty.attach(chosenProvider);
    },
    [bridged, pty],
  );

  const detach = useCallback(() => {
    pty.detach();
    bridged.detach();
    setMode(null);
  }, [bridged, pty]);

  const resumeFromHistory = useCallback(
    (session: ChatSessionFile): boolean => {
      if (session.mode !== "bridged") {
        options.onError?.("PTY sessions cannot be resumed from history — view only.");
        return false;
      }
      pty.detach();
      setMode("bridged");
      return bridged.resume(session);
    },
    [bridged, options, pty],
  );

  const active = mode === "bridged" ? bridged : mode === "pty" ? pty : null;

  return useMemo(
    () => ({
      status: (active?.status ?? "idle") as PtyChatStatus | BridgedChatStatus,
      provider: active?.provider ?? "unknown",
      turns: active?.turns ?? [],
      pendingText: active?.pendingText ?? "",
      resumeNotice: mode === "bridged" ? bridged.resumeNotice : null,
      suggestedProvider: pty.suggestedProvider,
      mode,
      attach,
      resumeFromHistory,
      send: (text: string, contextPaths?: string[]) => active?.send(text, contextPaths),
      stop: () => active?.stop(),
      detach,
      clearResumeNotice: bridged.clearResumeNotice,
    }),
    [active, attach, bridged.clearResumeNotice, bridged.resumeNotice, detach, mode, pty.suggestedProvider, resumeFromHistory],
  );
}
