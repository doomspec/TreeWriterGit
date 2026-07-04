import { useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DispatchSkillsPanel } from "@/components/dispatch/DispatchSkillsPanel";
import { AiChatThread } from "@/components/assistant/AiChatThread";
import type { AgentDispatchAction } from "@/lib/agentDispatchClient";
import { useAiChatSession } from "@/lib/aiChat/useAiChatSession";
import type { ChatSessionFile } from "@/lib/aiChat/sessionClient";
import { cn } from "@/lib/utils";

/**
 * Right-docked AI assistant panel — the single agent surface (see
 * plans/ai-assistant-panel.md, Stage 2). Top to bottom: chat transcript,
 * input, then collapsible Skills and Terminal sections.
 */
export function AiAssistantPanel({
  onClose,
  currentPath,
  refreshVersion,
  isUnit = false,
  canFanOut = false,
  onSendToTerminal,
  onError,
  onReconnect,
  onLayoutChange,
  terminalHostRef,
  connectionState,
  terminalOpen,
  onTerminalOpenChange,
  skillsOpen,
  onSkillsOpenChange,
  onEditSkill,
  onOpenFile,
  subscribeOutput,
  getTerminalSessionId,
  getLastInputLine,
  requestedHistoryOpenAt,
  requestedDispatchAction,
  onNavigateToUnit,
}: {
  onClose: () => void;
  currentPath: string;
  refreshVersion: number;
  isUnit?: boolean;
  canFanOut?: boolean;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onReconnect: () => void;
  onLayoutChange?: () => void;
  terminalHostRef: React.Ref<HTMLDivElement | null>;
  connectionState: string;
  terminalOpen: boolean;
  onTerminalOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  skillsOpen: boolean;
  onSkillsOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  onEditSkill: (filename: string) => void;
  /** Open a model-relative file path clicked in a chat message. */
  onOpenFile?: (path: string) => void;
  subscribeOutput: (listener: (chunk: string) => void) => () => void;
  getTerminalSessionId: () => string | null;
  getLastInputLine: () => string;
  /** Bumped externally (e.g. from the header's "..." menu) to open the chat session history. */
  requestedHistoryOpenAt?: number;
  /** Externally triggered dispatch hot action — stages prompt in chat composer. */
  requestedDispatchAction?: { action: AgentDispatchAction } | null;
  /** Navigate to a unit/section path (e.g. when resuming a history session). */
  onNavigateToUnit?: (path: string) => void;
}) {
  const chat = useAiChatSession({
    unitPath: currentPath,
    connectionState,
    onSendToTerminal,
    subscribeOutput,
    getTerminalSessionId,
    getLastInputLine,
    onError,
    onLaunchProvider: () => onTerminalOpenChange(true),
  });

  // xterm needs a refit whenever the terminal section geometry changes.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => onLayoutChange?.());
    return () => window.cancelAnimationFrame(raf);
  }, [terminalOpen, skillsOpen, onLayoutChange]);

  const handleResumeSession = (session: ChatSessionFile) => {
    onNavigateToUnit?.(session.unitPath);
    chat.resumeFromHistory(session);
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold tracking-tight">Assistant</span>
        <span className="ui-badge-neutral shrink-0 text-[10px]">
          {chat.status === "idle" || chat.status === "error"
            ? "no session"
            : chat.status === "attaching"
              ? "attaching…"
              : `${chat.provider} · ${chat.status === "capturing" || chat.status === "sending" ? "replying…" : "ready"}`}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Close assistant panel"
            aria-label="Close assistant panel"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <AiChatThread
        status={chat.status}
        terminalConnected={connectionState === "connected"}
        turns={chat.turns}
        pendingText={chat.pendingText}
        suggestedProvider={chat.suggestedProvider}
        onAttach={chat.attach}
        onSend={chat.send}
        onStop={chat.stop}
        onDetach={chat.detach}
        onOpenTerminal={() => onTerminalOpenChange(true)}
        currentPath={currentPath}
        isUnit={isUnit}
        canFanOut={canFanOut}
        onError={onError}
        onOpenFile={onOpenFile}
        requestedHistoryOpenAt={requestedHistoryOpenAt}
        requestedDispatchAction={requestedDispatchAction}
        resumeNotice={chat.resumeNotice}
        onClearResumeNotice={chat.clearResumeNotice}
        onResumeSession={handleResumeSession}
      />

      <section className="flex min-h-0 shrink-0 flex-col border-t border-border">
        <button
          type="button"
          className="flex h-8 shrink-0 items-center gap-1.5 px-2 text-left hover:bg-accent/40"
          aria-expanded={skillsOpen}
          onClick={() => onSkillsOpenChange((open) => !open)}
        >
          {skillsOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="ui-label flex-1 normal-case">Skills</span>
        </button>
        {skillsOpen ? (
          <div className="flex h-72 min-h-0 flex-col overflow-hidden">
            <DispatchSkillsPanel
              onError={onError}
              onSkillsChanged={() => {}}
              onEditSkill={onEditSkill}
            />
          </div>
        ) : null}
      </section>

      <section className="flex min-h-0 shrink-0 flex-col border-t border-border">
        <div className="flex h-8 shrink-0 items-center gap-0.5 pr-1.5">
          <button
            type="button"
            className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left hover:bg-accent/40"
            aria-expanded={terminalOpen}
            onClick={() => onTerminalOpenChange((open) => !open)}
          >
            {terminalOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <TerminalSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="ui-label flex-1 normal-case">Terminal</span>
            <span className="ui-badge-neutral shrink-0 text-[10px]">
              {connectionState.replace("_", " ")}
            </span>
          </button>
          {terminalOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              title="Resume terminal connection (keeps session and screen)"
              aria-label="Resume terminal connection"
              onClick={onReconnect}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <div
          className={cn(
            "assistant-terminal-host relative min-h-0 overflow-hidden bg-terminal",
            terminalOpen ? "h-72" : "hidden",
          )}
        >
          <div ref={terminalHostRef} className="terminal-mount" />
        </div>
      </section>
    </div>
  );
}
