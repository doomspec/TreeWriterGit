import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Square,
  Sparkles,
  TerminalSquare,
  Unlink,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PopoverMenu, PopoverMenuSection } from "@/components/ui/PopoverMenu";
import { ChatHistoryPanel } from "@/components/assistant/ChatHistoryPanel";
import type { ChatTurn } from "@/lib/aiChat/sessionClient";
import type { PtyChatStatus } from "@/lib/aiChat/usePtyChatSession";
import type { BridgedChatStatus } from "@/lib/aiChat/useBridgedChatSession";
import { KNOWN_PROVIDERS } from "@/lib/aiChat/providers";
import { fetchContextFiles } from "@/modelApi";
import {
  dispatchHotActionLabel,
  hotDispatchActions,
  previewAgentDispatch,
  type AgentDispatchAction,
} from "@/lib/agentDispatchClient";
import { cn } from "@/lib/utils";

type ChatStatus = PtyChatStatus | BridgedChatStatus;

type ContextFileOption = { path: string; label: string; category: string; defaultIncluded: boolean };

const CONTEXT_GROUP_ORDER = ["unit", "link", "literature", "data", "feedback"] as const;
const CONTEXT_GROUP_LABELS: Record<(typeof CONTEXT_GROUP_ORDER)[number], string> = {
  unit: "Manuscript",
  link: "Links",
  literature: "References",
  data: "Assets",
  feedback: "Feedback",
};

function groupContextFiles(files: ContextFileOption[]) {
  const groups = new Map<string, ContextFileOption[]>();
  for (const file of files) {
    const list = groups.get(file.category) ?? [];
    list.push(file);
    groups.set(file.category, list);
  }
  return CONTEXT_GROUP_ORDER.filter((category) => groups.has(category)).map((category) => ({
    category,
    label: CONTEXT_GROUP_LABELS[category],
    files: groups.get(category) ?? [],
  }));
}

function fileLabel(path: string): string {
  return path.split("/").pop() ?? path;
}

function shortPathLabel(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path;
}

/**
 * Always-visible pointer to which section/unit the chat is scoped to. Also
 * hosts the session-level controls (attach files, history, end session) so
 * they live in one compact bar instead of a row each.
 */
function ContextPointer({
  currentPath,
  onOpenHistory,
  actions,
}: {
  currentPath: string;
  onOpenHistory?: () => void;
  /** Extra icon controls (attach-files, end session) — only relevant once attached. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground"
      title={currentPath || undefined}
    >
      <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {currentPath ? shortPathLabel(currentPath) : "No section or unit open"}
      </span>
      {actions}
      {onOpenHistory ? (
        <button
          type="button"
          title="Past sessions for this unit"
          aria-label="Open session history"
          onClick={onOpenHistory}
          className="shrink-0 rounded-sm p-0.5 hover:bg-accent/60 hover:text-foreground"
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Presentational chat transcript + composer (plans/ai-assistant-panel.md,
 * Stages 4 & 6). All chat state lives in useAiChatSession, which dispatches
 * to bridged mode (known providers) or PTY mode ("unknown"); this component
 * renders the result, the hot-command row shared with AI dispatch, and the
 * always-visible section/unit context pointer.
 */
export function AiChatThread({
  status,
  terminalConnected,
  turns,
  pendingText,
  suggestedProvider,
  onAttach,
  onSend,
  onStop,
  onDetach,
  onOpenTerminal,
  currentPath,
  isUnit,
  canFanOut,
  onError,
}: {
  status: ChatStatus;
  terminalConnected: boolean;
  turns: ChatTurn[];
  pendingText: string;
  suggestedProvider: string | null;
  onAttach: (provider: string) => void;
  onSend: (text: string, contextPaths?: string[]) => void;
  onStop: () => void;
  onDetach: () => void;
  onOpenTerminal: () => void;
  currentPath: string;
  isUnit: boolean;
  canFanOut: boolean;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [providerChoice, setProviderChoice] = useState(suggestedProvider ?? "unknown");
  const [autoRun, setAutoRun] = useState(false);
  const [promptLabel, setPromptLabel] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [buildingAction, setBuildingAction] = useState<AgentDispatchAction | null>(null);
  const [contextCandidates, setContextCandidates] = useState<ContextFileOption[]>([]);
  const [attachedPaths, setAttachedPaths] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hotActionsOpen, setHotActionsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isBridgedChoice = providerChoice !== "unknown";
  const isBusy = status === "capturing" || status === "sending";
  const canSend = status === "attached";

  useEffect(() => {
    if (status === "idle") setProviderChoice(suggestedProvider ?? "unknown");
  }, [status, suggestedProvider]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, pendingText]);

  useEffect(() => {
    setAttachedPaths([]);
    if (!currentPath) {
      setContextCandidates([]);
      return;
    }
    let cancelled = false;
    void fetchContextFiles(currentPath, "draft")
      .then(({ files }: { files: ContextFileOption[] }) => {
        if (!cancelled) setContextCandidates(files);
      })
      .catch(() => {
        if (!cancelled) setContextCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  const toggleAttachedPath = (path: string) => {
    setAttachedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const submitDraft = () => {
    if (!canSend || !draft.trim()) return;
    onSend(draft, attachedPaths.length ? attachedPaths : undefined);
    setDraft("");
    setPromptLabel(null);
    setPromptExpanded(false);
  };

  const runHotAction = async (action: AgentDispatchAction) => {
    if (!currentPath && action !== "refresh-index") return;
    setBuildingAction(action);
    try {
      const preview = await previewAgentDispatch({ unitPath: currentPath, action });
      if (autoRun) {
        onSend(preview.prompt);
      } else {
        setDraft(preview.prompt);
        setPromptLabel(dispatchHotActionLabel(action));
        // Expanded by default — the whole point of staging (vs. auto-run) is
        // to actually read/edit the built prompt before sending it.
        setPromptExpanded(true);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuildingAction(null);
    }
  };

  const hotActions = hotDispatchActions({ isUnit, canFanOut }).filter(
    (action) => action !== "custom",
  );

  if (historyOpen) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ContextPointer currentPath={currentPath} />
        <ChatHistoryPanel
          unitPath={currentPath}
          onClose={() => setHistoryOpen(false)}
          onError={onError}
        />
      </div>
    );
  }

  if (status === "idle" || status === "attaching" || status === "error") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ContextPointer currentPath={currentPath} onOpenHistory={() => setHistoryOpen(true)} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 text-center">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">No agent session</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Pick a CLI below to chat with it directly, or choose "Already running" to talk
              through a session you started yourself in the terminal (any flags, any provider).
              Every turn is traced into the repo.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={providerChoice}
              onChange={(event) => setProviderChoice(event.target.value)}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
              aria-label="Agent provider"
            >
              <option value="unknown">Already running / other</option>
              {KNOWN_PROVIDERS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={status === "attaching" || (!isBridgedChoice && !terminalConnected)}
              onClick={() => onAttach(providerChoice)}
            >
              {status === "attaching" ? "Attaching…" : "Attach"}
            </Button>
          </div>
          {isBridgedChoice ? (
            <p className="text-[10px] text-muted-foreground/70">
              Talks to <code className="font-mono">{providerChoice}</code> directly — no terminal
              needed.
            </p>
          ) : !terminalConnected ? (
            <p className="text-[10px] text-muted-foreground/70">
              Terminal not connected yet — open it below first.
            </p>
          ) : null}
          {status === "error" && !isBridgedChoice ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onOpenTerminal}
            >
              <TerminalSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Open terminal
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const attachMenu = (
    <PopoverMenu
      align="end"
      disabled={!canSend || contextCandidates.length === 0}
      title="Attach context files"
      aria-label="Attach context files"
      triggerClassName="h-5 w-5 px-0"
      trigger={
        <span className="relative flex items-center justify-center">
          <Paperclip className="h-3 w-3" aria-hidden="true" />
          {attachedPaths.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-primary-foreground">
              {attachedPaths.length}
            </span>
          ) : null}
        </span>
      }
    >
      <PopoverMenuSection>
        <div className="max-h-64 w-64 space-y-2 overflow-y-auto px-1">
          {groupContextFiles(contextCandidates).map((group) => (
            <div key={group.category} className="space-y-0.5">
              <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              {group.files.map((file) => (
                <label
                  key={file.path}
                  className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={attachedPaths.includes(file.path)}
                    onChange={() => toggleAttachedPath(file.path)}
                    className="h-3 w-3 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate" title={file.path}>
                    {file.label}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </PopoverMenuSection>
    </PopoverMenu>
  );

  return (
    <>
      <ContextPointer
        currentPath={currentPath}
        onOpenHistory={() => setHistoryOpen(true)}
        actions={
          <>
            {attachMenu}
            <button
              type="button"
              title="End chat session"
              aria-label="End chat session"
              onClick={onDetach}
              className="shrink-0 rounded-sm p-0.5 hover:bg-accent/60 hover:text-foreground"
            >
              <Unlink className="h-3 w-3" aria-hidden="true" />
            </button>
          </>
        }
      />
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 py-2">
        {turns.length === 0 && !pendingText ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Attached. Send a message, or run a hot command below.
          </p>
        ) : null}
        {turns.map((turn, index) => (
          <ChatBubble key={index} turn={turn} />
        ))}
        {pendingText ? (
          <ChatBubble turn={{ role: "assistant", text: pendingText, at: "" }} pending />
        ) : isBusy ? (
          <ChatBubble turn={{ role: "assistant", text: "…", at: "" }} pending />
        ) : null}
      </div>

      {attachedPaths.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-border px-2 py-1">
          {attachedPaths.map((path) => (
            <span
              key={path}
              className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
              title={path}
            >
              {fileLabel(path)}
              <button
                type="button"
                onClick={() => toggleAttachedPath(path)}
                aria-label={`Detach ${fileLabel(path)}`}
                className="hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col border-t border-border">
        <button
          type="button"
          className="flex h-7 shrink-0 items-center gap-1.5 px-2 text-left hover:bg-accent/40"
          aria-expanded={hotActionsOpen}
          onClick={() => setHotActionsOpen((open) => !open)}
        >
          {hotActionsOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-[11px] font-medium text-muted-foreground">AI actions</span>
          <span className="ui-badge-neutral shrink-0 text-[10px]">{hotActions.length}</span>
        </button>
        {hotActionsOpen ? (
          <div className="flex flex-wrap items-center gap-1 border-t border-border/60 px-2 py-1.5">
            {hotActions.map((action) => (
              <Button
                key={action}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px]"
                disabled={!canSend || (!currentPath && action !== "refresh-index")}
                title={`Build the ${dispatchHotActionLabel(action).toLowerCase()} prompt (same context + skills as AI dispatch)`}
                onClick={() => void runHotAction(action)}
              >
                {buildingAction === action ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : null}
                {dispatchHotActionLabel(action)}
              </Button>
            ))}
            <label className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                checked={autoRun}
                onChange={(event) => setAutoRun(event.target.checked)}
                className="h-3 w-3"
              />
              Auto-run
            </label>
          </div>
        ) : null}
      </div>

      {status === "capturing" ? (
        <div className="flex shrink-0 items-center gap-1 border-t border-border px-2 py-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 text-[11px]"
            onClick={onStop}
          >
            <Square className="h-3 w-3" aria-hidden="true" />
            Stop
          </Button>
        </div>
      ) : null}

      <form
        className="shrink-0 border-t border-border p-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitDraft();
        }}
      >
        {promptLabel ? (
          <button
            type="button"
            onClick={() => setPromptExpanded((v) => !v)}
            className="mb-1 flex w-full items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-left text-[10px] text-muted-foreground hover:bg-muted/60"
          >
            {promptExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">
              {promptLabel} prompt built — {promptExpanded ? "hide" : "show"} full text (
              {draft.length.toLocaleString()} chars)
            </span>
          </button>
        ) : null}
        <textarea
          rows={promptLabel && !promptExpanded ? 2 : 10}
          value={draft}
          disabled={!canSend}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
          placeholder={canSend ? "Message the agent…" : "Waiting for the current reply…"}
          className={cn(
            "w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs",
            "placeholder:text-muted-foreground/70 disabled:bg-muted/40 disabled:text-muted-foreground",
            promptLabel && !promptExpanded
              ? "resize-none overflow-hidden text-muted-foreground"
              : "max-h-64 resize-y overflow-y-auto",
          )}
        />
        <div className="mt-1 flex items-center justify-between px-0.5">
          <p className="text-[10px] text-muted-foreground/70">
            Enter to send · Shift+Enter for newline
          </p>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={!canSend || !draft.trim()}
            aria-label="Send message"
            title="Send message"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </>
  );
}

const LONG_MESSAGE_THRESHOLD = 320;

/** Long messages (typically a hot-command-built prompt) collapse behind a toggle. */
export function ChatBubble({ turn, pending = false }: { turn: ChatTurn; pending?: boolean }) {
  const isUser = turn.role === "user";
  const isLong = turn.text.length > LONG_MESSAGE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const collapsedPreview = isLong ? `${turn.text.slice(0, LONG_MESSAGE_THRESHOLD).trimEnd()}…` : turn.text;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          pending && "opacity-70",
        )}
      >
        {isLong && !expanded ? collapsedPreview : turn.text}
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "mt-1 block text-[10px] font-medium underline underline-offset-2",
              isUser ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {expanded ? "Show less" : `Show full message (${turn.text.length.toLocaleString()} chars)`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
