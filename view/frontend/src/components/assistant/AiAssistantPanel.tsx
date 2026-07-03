import { useEffect, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DispatchWorkspace,
  type DispatchPaneTab,
} from "@/components/dispatch/DispatchWorkspace";
import { DispatchSkillsPanel } from "@/components/dispatch/DispatchSkillsPanel";
import { AiChatThread } from "@/components/assistant/AiChatThread";
import type { AgentDispatchIntent } from "@/lib/agentDispatchPanel";
import { useDispatchSessions } from "@/lib/useDispatchSessions";
import { useAiChatSession } from "@/lib/aiChat/useAiChatSession";
import {
  loadDispatchPanelState,
  scheduleSaveDispatchPanelState,
} from "@/lib/dispatchPanelState";
import { cn } from "@/lib/utils";

/**
 * Right-docked AI assistant panel — the single agent surface (see
 * plans/ai-assistant-panel.md, Stage 2). Top to bottom: chat transcript
 * (wired in Stage 4), input, then collapsible Terminal and Dispatch
 * sections. The user initiates an agent session in the terminal section;
 * the chat then substitutes terminal interaction with repo-versioned traces.
 */
export function AiAssistantPanel({
  onClose,
  currentPath,
  refreshVersion,
  isUnit = false,
  canFanOut = false,
  dispatchIntent = null,
  onDispatchIntentConsumed,
  initialDispatchTab,
  onSendToTerminal,
  onError,
  onReconnect,
  onLayoutChange,
  terminalHostRef,
  connectionState,
  terminalOpen,
  onTerminalOpenChange,
  dispatchOpen,
  onDispatchOpenChange,
  skillsOpen,
  onSkillsOpenChange,
  onEditSkill,
  subscribeOutput,
  getTerminalSessionId,
  getLastInputLine,
}: {
  onClose: () => void;
  currentPath: string;
  refreshVersion: number;
  isUnit?: boolean;
  canFanOut?: boolean;
  dispatchIntent?: AgentDispatchIntent | null;
  onDispatchIntentConsumed?: () => void;
  initialDispatchTab?: DispatchPaneTab;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onReconnect: () => void;
  onLayoutChange?: () => void;
  terminalHostRef: React.Ref<HTMLDivElement | null>;
  connectionState: string;
  terminalOpen: boolean;
  onTerminalOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  dispatchOpen: boolean;
  onDispatchOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  skillsOpen: boolean;
  onSkillsOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  onEditSkill: (filename: string) => void;
  subscribeOutput: (listener: (chunk: string) => void) => () => void;
  getTerminalSessionId: () => string | null;
  getLastInputLine: () => string;
}) {
  const [dispatchTab, setDispatchTab] = useState<DispatchPaneTab>("run");
  const [selectedSessionFilename, setSelectedSessionFilename] = useState<string | null>(null);
  const [skillsVersion, setSkillsVersion] = useState(0);

  const { sessions, reload, markStatus } = useDispatchSessions(currentPath, refreshVersion);

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

  useEffect(() => {
    setSelectedSessionFilename(loadDispatchPanelState(currentPath)?.selectedSessionFilename ?? null);
  }, [currentPath]);

  useEffect(() => {
    if (!currentPath) return;
    scheduleSaveDispatchPanelState(currentPath, { selectedSessionFilename });
  }, [currentPath, selectedSessionFilename]);

  useEffect(() => {
    if (initialDispatchTab) setDispatchTab(initialDispatchTab);
  }, [initialDispatchTab]);

  // An incoming dispatch intent means the user asked to run the agent on
  // something specific — surface the dispatch section.
  useEffect(() => {
    if (!dispatchIntent) return;
    setDispatchTab("run");
    onDispatchOpenChange(true);
  }, [dispatchIntent, onDispatchOpenChange]);

  // xterm needs a refit whenever the terminal section geometry changes.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => onLayoutChange?.());
    return () => window.cancelAnimationFrame(raf);
  }, [terminalOpen, dispatchOpen, skillsOpen, onLayoutChange]);

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
      />

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
        {/* Keep the host mounted when collapsed so xterm doesn't detach. */}
        <div
          className={cn(
            "assistant-terminal-host relative min-h-0 overflow-hidden bg-terminal",
            terminalOpen ? "h-72" : "hidden",
          )}
        >
          <div ref={terminalHostRef} className="terminal-mount" />
        </div>
      </section>

      <section className="flex min-h-0 shrink-0 flex-col border-t border-border">
        <button
          type="button"
          className="flex h-8 shrink-0 items-center gap-1.5 px-2 text-left hover:bg-accent/40"
          aria-expanded={dispatchOpen}
          onClick={() => onDispatchOpenChange((open) => !open)}
        >
          {dispatchOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="ui-label flex-1 normal-case">AI dispatch</span>
          {sessions.length > 0 ? (
            <span className="ui-badge-neutral shrink-0 text-[10px]">{sessions.length}</span>
          ) : null}
        </button>
        {dispatchOpen ? (
          <div className="flex h-80 min-h-0 flex-col overflow-hidden">
            <DispatchWorkspace
              activeTab={dispatchTab}
              onTabChange={setDispatchTab}
              currentPath={currentPath}
              refreshVersion={refreshVersion}
              isUnit={isUnit}
              canFanOut={canFanOut}
              dispatchIntent={dispatchIntent}
              onDispatchIntentConsumed={onDispatchIntentConsumed}
              onSendToTerminal={onSendToTerminal}
              onError={onError}
              onLayoutChange={onLayoutChange}
              onSessionsReload={reload}
              sessions={sessions}
              selectedSessionFilename={selectedSessionFilename}
              onSelectSession={(session) => setSelectedSessionFilename(session?.filename ?? null)}
              onMarkStatus={markStatus}
              skillsVersion={skillsVersion}
            />
          </div>
        ) : null}
      </section>

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
              onSkillsChanged={() => setSkillsVersion((v) => v + 1)}
              onEditSkill={onEditSkill}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
