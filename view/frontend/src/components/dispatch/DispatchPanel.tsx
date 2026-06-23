import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { fetchContextFiles, fanOutDispatch } from "@/modelApi";
import {
  type AgentDispatchAction,
  type AgentPreviewResult,
  createUnitSession,
  dispatchHotActionLabel,
  hotDispatchActions,
  loadAgentProviderConfig,
  patchUnitSession,
  previewAgentDispatch,
} from "@/lib/agentDispatchClient";
import { saveLastAgentProvider, resolveAgentProvider } from "@/lib/lastAgentProvider";
import type { AgentDispatchIntent } from "@/lib/agentDispatchPanel";
import type { AiProviderInfo } from "@/lib/settingsApi";

interface ContextFileOption {
  path: string;
  label: string;
  category: string;
  defaultIncluded: boolean;
}

type AiProvider = AiProviderInfo;
type PreviewResult = AgentPreviewResult;

const FAN_OUT_ACTIONS = new Set<AgentDispatchAction>(["draft", "revise", "expand", "cite-check"]);

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

function selectedCountInGroup(files: ContextFileOption[], selected: Set<string>): number {
  return files.filter((file) => selected.has(file.path)).length;
}

export function DispatchPanel({
  currentPath,
  refreshVersion,
  onSendToTerminal,
  onError,
  onToggle,
  embedded = false,
  isUnit = false,
  canFanOut = false,
  dispatchIntent = null,
  onDispatchIntentConsumed,
  onPreviewChange,
  onSessionsReload,
}: {
  currentPath: string;
  refreshVersion?: number;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onToggle?: () => void;
  embedded?: boolean;
  isUnit?: boolean;
  canFanOut?: boolean;
  dispatchIntent?: AgentDispatchIntent | null;
  onDispatchIntentConsumed?: () => void;
  onPreviewChange?: (preview: PreviewResult | null) => void;
  onSessionsReload?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(embedded);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [action, setAction] = useState<AgentDispatchAction>("draft");
  const [customPrompt, setCustomPrompt] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [editedCommand, setEditedCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<AgentDispatchAction | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [contextFiles, setContextFiles] = useState<ContextFileOption[]>([]);
  const [selectedContext, setSelectedContext] = useState<Set<string>>(new Set());
  const pendingSessionRef = useRef<string | null>(null);
  const pendingExecuteActionRef = useRef<AgentDispatchAction | null>(null);
  const previewSessionIdRef = useRef<string>(
    `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  );

  const hotActions = useMemo(
    () => hotDispatchActions({ isUnit, canFanOut }),
    [canFanOut, isUnit],
  );

  const loadProviders = async () => {
    if (providersLoaded) return;
    try {
      const data = await loadAgentProviderConfig();
      setProviders(data.aiProviders);
      setSelectedProvider(
        resolveAgentProvider(
          data.defaultProvider,
          data.aiProviders.map((p) => p.name),
        ),
      );
      setProvidersLoaded(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const showContextPicker =
    Boolean(currentPath) && (isUnit || (canFanOut && action === "summarize-outline"));
  const contextGroups = useMemo(() => groupContextFiles(contextFiles), [contextFiles]);

  useEffect(() => {
    if ((!open && !embedded) || !showContextPicker) {
      setContextFiles([]);
      setSelectedContext(new Set());
      return;
    }
    void fetchContextFiles(currentPath, action)
      .then(({ files }) => {
        setContextFiles(files);
        setSelectedContext(new Set(files.filter((f) => f.defaultIncluded).map((f) => f.path)));
      })
      .catch(() => {
        setContextFiles([]);
      });
  }, [action, currentPath, embedded, open, showContextPicker]);

  useEffect(() => {
    if (open || embedded) void loadProviders();
  }, [embedded, open]);

  useEffect(() => {
    if (!dispatchIntent) return;
    setAction(dispatchIntent.action);
    setPreview(null);
    setEditedCommand("");
    if (dispatchIntent.autoPreview) {
      pendingExecuteActionRef.current = dispatchIntent.action;
    }
    onDispatchIntentConsumed?.();
  }, [dispatchIntent, onDispatchIntentConsumed]);

  useEffect(() => {
    onPreviewChange?.(preview);
  }, [onPreviewChange, preview]);

  useEffect(() => {
    if (!refreshVersion || !pendingSessionRef.current || !currentPath) return;
    const filename = pendingSessionRef.current;
    pendingSessionRef.current = null;
    void (async () => {
      try {
        await patchUnitSession({
          unitPath: currentPath,
          filename,
          status: "complete",
        });
        await onSessionsReload?.();
      } catch {
        // non-fatal
      }
    })();
  }, [currentPath, onSessionsReload, refreshVersion]);

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        void loadProviders();
        void onSessionsReload?.();
      }
      window.requestAnimationFrame(() => onToggle?.());
      return next;
    });
    setPreview(null);
    setEditedCommand("");
  };

  const recordSession = async (command: string, sessionAction: AgentDispatchAction) => {
    try {
      const filename = await createUnitSession({
        unitPath: currentPath,
        provider: selectedProvider,
        action: sessionAction,
        command,
      });
      if (filename) pendingSessionRef.current = filename;
      await onSessionsReload?.();
    } catch {
      // non-fatal
    }
  };

  const handlePreview = useCallback(
    async (
      runAfter = false,
      actionOverride?: AgentDispatchAction,
    ): Promise<void> => {
      const effectiveAction = actionOverride ?? action;
      if (!currentPath && effectiveAction !== "refresh-index") {
        onError("Navigate to a unit or folder first");
        return;
      }
      if (
        !isUnit &&
        !canFanOut &&
        effectiveAction !== "refresh-index" &&
        effectiveAction !== "summarize-outline"
      ) {
        onError("Open a unit folder to run, or use a section with units");
        return;
      }
      if (effectiveAction === "custom" && !customPrompt.trim()) {
        setPromptOpen(true);
        onError("Enter a custom prompt first");
        return;
      }

      setLoading(true);
      setRunningAction(effectiveAction);
      setPreview(null);
      setEditedCommand("");
      previewSessionIdRef.current = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const contextPaths = showContextPicker ? [...selectedContext] : undefined;
        const data = await previewAgentDispatch({
          unitPath: currentPath,
          action: effectiveAction,
          provider: selectedProvider,
          customPrompt: effectiveAction === "custom" ? customPrompt : undefined,
          sessionId: previewSessionIdRef.current,
          contextPaths,
        });
        setPreview(data);
        setEditedCommand(data.command);
        if (runAfter) {
          saveLastAgentProvider(selectedProvider);
          onSendToTerminal(data.command + "\n");
          await recordSession(data.command, effectiveAction);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setRunningAction(null);
      }
    },
    [
      action,
      canFanOut,
      currentPath,
      customPrompt,
      isUnit,
      onError,
      onSendToTerminal,
      selectedContext,
      selectedProvider,
      showContextPicker,
    ],
  );

  const handleFanOut = useCallback(
    async (actionOverride?: AgentDispatchAction) => {
      const effectiveAction = actionOverride ?? action;
      if (!canFanOut || !currentPath) return;
      if (effectiveAction === "custom") {
        setPromptOpen(true);
        onError("Custom fan-out is not supported");
        return;
      }
      setLoading(true);
      setRunningAction(effectiveAction);
      try {
        const { units } = await fanOutDispatch({
          sectionPath: currentPath,
          action: effectiveAction,
          provider: selectedProvider,
        });
        if (units.length === 0) {
          onError("No units found under this section");
          return;
        }
        saveLastAgentProvider(selectedProvider);
        for (const unit of units) {
          onSendToTerminal(unit.command + "\n");
          await new Promise((resolve) => window.setTimeout(resolve, 400));
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setRunningAction(null);
      }
    },
    [action, canFanOut, currentPath, onError, onSendToTerminal, selectedProvider],
  );

  const executeAction = useCallback(
    async (targetAction: AgentDispatchAction) => {
      setAction(targetAction);
      if (targetAction === "custom") {
        setPromptOpen(true);
        return;
      }
      if (canFanOut && FAN_OUT_ACTIONS.has(targetAction)) {
        await handleFanOut(targetAction);
        return;
      }
      await handlePreview(true, targetAction);
    },
    [canFanOut, handleFanOut, handlePreview],
  );

  useEffect(() => {
    if (!providersLoaded || !selectedProvider || !pendingExecuteActionRef.current) return;
    const executeActionValue = pendingExecuteActionRef.current;
    pendingExecuteActionRef.current = null;
    void executeAction(executeActionValue);
  }, [executeAction, providersLoaded, selectedProvider, currentPath]);

  const handleRunEdited = () => {
    if (!editedCommand.trim()) return;
    saveLastAgentProvider(selectedProvider);
    onSendToTerminal(editedCommand + "\n");
    void recordSession(editedCommand, action);
  };

  const toggleContextPath = (filePath: string, checked: boolean) => {
    setSelectedContext((prev) => {
      const next = new Set(prev);
      if (checked) next.add(filePath);
      else next.delete(filePath);
      return next;
    });
    setPreview(null);
    setEditedCommand("");
  };

  const canRunAction = (targetAction: AgentDispatchAction) => {
    if (loading) return false;
    if (targetAction === "custom") return true;
    if (!currentPath && targetAction !== "refresh-index") return false;
    if (
      !isUnit &&
      !canFanOut &&
      targetAction !== "refresh-index" &&
      targetAction !== "summarize-outline"
    ) {
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!embedded && !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        void executeAction(action);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [action, embedded, executeAction, open]);

  return (
    <div className="bg-sidebar">
      {!embedded ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-muted-foreground hover:bg-accent/40"
          onClick={handleToggle}
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="font-semibold uppercase tracking-wide">AI Dispatch</span>
          {currentPath && (
            <span className="ml-auto max-w-[140px] truncate font-mono opacity-60">{currentPath}</span>
          )}
        </button>
      ) : null}

      {(open || embedded) && (
        <div className="space-y-2 px-3 pb-3">
          <select
            className="h-7 w-full rounded-sm border border-border bg-background px-2 text-xs"
            value={selectedProvider}
            onChange={(e) => {
              setSelectedProvider(e.target.value);
              saveLastAgentProvider(e.target.value);
              setPreview(null);
              setEditedCommand("");
            }}
          >
            {providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="dispatch-hot-actions flex flex-wrap gap-1">
            {hotActions.map((hotAction) => {
              const isRunning = runningAction === hotAction;
              return (
                <Button
                  key={hotAction}
                  type="button"
                  variant={action === hotAction ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  disabled={!canRunAction(hotAction)}
                  aria-busy={isRunning}
                  title={dispatchHotActionLabel(hotAction)}
                  onClick={() => void executeAction(hotAction)}
                >
                  {isRunning ? "…" : dispatchHotActionLabel(hotAction)}
                </Button>
              );
            })}
          </div>

          {showContextPicker && contextFiles.length > 0 ? (
            <div className="rounded-sm border border-border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/40"
                onClick={() => setContextOpen((v) => !v)}
              >
                {contextOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Unit context ({selectedContext.size}/{contextFiles.length})
              </button>
              {contextOpen ? (
                <div className="max-h-40 space-y-1 overflow-auto border-t border-border px-2 py-1.5">
                  {contextGroups.map((group) => {
                    const selectedInGroup = selectedCountInGroup(group.files, selectedContext);
                    const isRefs = group.category === "literature";
                    const fileList = (
                      <ul className="space-y-1 pl-1">
                        {group.files.map((file) => (
                          <li key={file.path}>
                            <label className="flex cursor-pointer items-start gap-2 text-[11px]">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={selectedContext.has(file.path)}
                                onChange={(e) => toggleContextPath(file.path, e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="min-w-0 truncate font-medium">{file.label}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    );

                    return (
                      <div key={group.category} className="space-y-1">
                        {isRefs ? (
                          <details className="group/refs rounded-sm">
                            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                              <ChevronRight
                                className="h-3 w-3 shrink-0 transition-transform group-open/refs:rotate-90"
                                aria-hidden="true"
                              />
                              {group.label} ({selectedInGroup}/{group.files.length})
                            </summary>
                            {fileList}
                          </details>
                        ) : (
                          <>
                            <p className="px-1 text-[11px] font-medium text-muted-foreground">
                              {group.label} ({selectedInGroup}/{group.files.length})
                            </p>
                            {fileList}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-sm border border-border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/40"
              onClick={() => setPromptOpen((v) => !v)}
            >
              {promptOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Prompt & command
              {preview ? <span className="ml-auto text-[10px] opacity-70">ready</span> : null}
            </button>
            {promptOpen ? (
              <div className="space-y-2 border-t border-border px-2 py-2">
                {action === "custom" ? (
                  <textarea
                    className="w-full rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs"
                    rows={3}
                    placeholder="Custom prompt…"
                    value={customPrompt}
                    onChange={(e) => {
                      setCustomPrompt(e.target.value);
                      setPreview(null);
                      setEditedCommand("");
                    }}
                  />
                ) : null}

                {preview ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer select-none text-muted-foreground">Prompt text</summary>
                    <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed">
                      {preview.prompt}
                    </pre>
                  </details>
                ) : null}

                <textarea
                  className={cn(
                    "min-h-[4.5rem] w-full resize-y rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-xs leading-relaxed",
                    !preview && "text-muted-foreground",
                  )}
                  rows={3}
                  value={preview ? editedCommand : "Run an action above to generate a command"}
                  readOnly={!preview}
                  onChange={(e) => setEditedCommand(e.target.value)}
                />
                {preview ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                      disabled={loading || !editedCommand.trim()}
                      onClick={handleRunEdited}
                    >
                      Run edited command
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
