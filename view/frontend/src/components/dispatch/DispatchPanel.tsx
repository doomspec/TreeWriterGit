import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, ChevronRight, Clock, Eye, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { fetchContextFiles, fanOutDispatch } from "@/modelApi";
import {
  type AgentDispatchAction,
  type AgentPreviewResult,
  type AgentSessionFile,
  createUnitSession,
  fetchUnitSessions,
  loadAgentProviderConfig,
  patchUnitSession,
  previewAgentDispatch,
} from "@/lib/agentDispatchClient";
import { saveLastAgentProvider, resolveAgentProvider } from "@/lib/lastAgentProvider";
import type { AiProviderInfo } from "@/lib/settingsApi";

interface ContextFileOption {
  path: string;
  label: string;
  category: string;
  defaultIncluded: boolean;
}

type AiProvider = AiProviderInfo;
type PreviewResult = AgentPreviewResult;
type SessionFile = AgentSessionFile;

const ACTIONS: { value: AgentDispatchAction; label: string }[] = [
  { value: "draft", label: "Draft from outline" },
  { value: "sync-outline", label: "Sync outline from draft" },
  { value: "revise", label: "Revise draft" },
  { value: "expand", label: "Expand draft" },
  { value: "cite-check", label: "Cite-check" },
  { value: "refresh-index", label: "Refresh outline" },
  { value: "custom", label: "Custom" },
];

const STATUS_COLOR: Record<SessionFile["status"], string> = {
  dispatched: "text-warning",
  complete: "text-success",
  skipped: "text-muted-foreground",
};

const STATUS_ICON: Record<SessionFile["status"], string> = {
  dispatched: "⏳",
  complete: "✓",
  skipped: "—",
};

function formatAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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
}: {
  currentPath: string;
  refreshVersion?: number;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onToggle?: () => void;
  embedded?: boolean;
  isUnit?: boolean;
  canFanOut?: boolean;
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
  const [sessions, setSessions] = useState<SessionFile[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [contextFiles, setContextFiles] = useState<ContextFileOption[]>([]);
  const [selectedContext, setSelectedContext] = useState<Set<string>>(new Set());
  const [fanOutRunning, setFanOutRunning] = useState(false);
  const pendingSessionRef = useRef<string | null>(null);
  const previewSessionIdRef = useRef<string>(
    `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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

  const loadSessions = useCallback(async (unitPath: string) => {
    if (!unitPath) {
      setSessions([]);
      return;
    }
    setSessions(await fetchUnitSessions(unitPath));
  }, []);

  useEffect(() => {
    if ((!open && !embedded) || !isUnit || !currentPath) {
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
  }, [action, currentPath, embedded, isUnit, open]);

  useEffect(() => {
    if (open || embedded) void loadProviders();
  }, [embedded, open]);

  useEffect(() => {
    if (open || embedded) void loadSessions(currentPath);
  }, [currentPath, embedded, open, loadSessions]);

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
        await loadSessions(currentPath);
      } catch {
        // non-fatal
      }
    })();
  }, [currentPath, loadSessions, refreshVersion]);

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        void loadProviders();
        void loadSessions(currentPath);
      }
      window.requestAnimationFrame(() => onToggle?.());
      return next;
    });
    setPreview(null);
    setEditedCommand("");
  };

  const handlePreview = async (runAfter = false): Promise<void> => {
    if (!currentPath && action !== "refresh-index") {
      onError("Navigate to a unit or folder first");
      return;
    }
    if (!isUnit && !canFanOut && action !== "refresh-index") {
      onError("Open a unit folder to preview, or use section fan-out");
      return;
    }
    setLoading(true);
    setPreview(null);
    setEditedCommand("");
    previewSessionIdRef.current = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      const contextPaths = isUnit ? [...selectedContext] : undefined;
      const data = await previewAgentDispatch({
        unitPath: currentPath,
        action,
        provider: selectedProvider,
        customPrompt: action === "custom" ? customPrompt : undefined,
        sessionId: previewSessionIdRef.current,
        contextPaths,
      });
      setPreview(data);
      setEditedCommand(data.command);
      if (runAfter) {
        saveLastAgentProvider(selectedProvider);
        onSendToTerminal(data.command + "\n");
        await recordSession(data.command);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const recordSession = async (command: string) => {
    try {
      const filename = await createUnitSession({
        unitPath: currentPath,
        provider: selectedProvider,
        action,
        command,
      });
      if (filename) pendingSessionRef.current = filename;
      await loadSessions(currentPath);
    } catch {
      // non-fatal
    }
  };

  const handleRun = () => {
    if (editedCommand && preview) {
      saveLastAgentProvider(selectedProvider);
      onSendToTerminal(editedCommand + "\n");
      void recordSession(editedCommand);
    } else {
      void handlePreview(true);
    }
  };

  const handleFanOut = async () => {
    if (!canFanOut || !currentPath) return;
    setFanOutRunning(true);
    try {
      const { units } = await fanOutDispatch({
        sectionPath: currentPath,
        action,
        provider: selectedProvider,
        customPrompt: action === "custom" ? customPrompt : undefined,
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
      setFanOutRunning(false);
    }
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

  const handleMarkStatus = async (session: SessionFile, status: SessionFile["status"]) => {
    try {
      await patchUnitSession({
        unitPath: currentPath,
        filename: session.filename,
        status,
      });
      await loadSessions(currentPath);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!embedded && !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleRun();
      }
      if (event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        void handlePreview(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedded, open]);

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
          {sessions.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {sessions.length}
            </span>
          )}
          {currentPath && (
            <span className="ml-auto max-w-[140px] truncate font-mono opacity-60">{currentPath}</span>
          )}
        </button>
      ) : null}

      {(open || embedded) && (
        <div className="space-y-2 px-3 pb-3">
          {/* Provider + action */}
          <div className="flex gap-2">
            <select
              className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-xs"
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                saveLastAgentProvider(e.target.value);
                setPreview(null);
                setEditedCommand("");
              }}
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <select
              className="h-7 w-28 rounded-sm border border-border bg-background px-2 text-xs"
              value={action}
              onChange={(e) => { setAction(e.target.value as AgentDispatchAction); setPreview(null); setEditedCommand(""); }}
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Custom prompt */}
          {action === "custom" && (
            <textarea
              className="w-full rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs"
              rows={3}
              placeholder="Custom prompt…"
              value={customPrompt}
              onChange={(e) => { setCustomPrompt(e.target.value); setPreview(null); setEditedCommand(""); }}
            />
          )}

          {isUnit && contextFiles.length > 0 ? (
            <div className="rounded-sm border border-border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/40"
                onClick={() => setContextOpen((v) => !v)}
              >
                {contextOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Context files ({selectedContext.size}/{contextFiles.length})
              </button>
              {contextOpen ? (
                <ul className="max-h-32 space-y-1 overflow-auto border-t border-border px-2 py-1.5">
                  {contextFiles.map((file) => (
                    <li key={file.path}>
                      <label className="flex cursor-pointer items-start gap-2 text-[11px]">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedContext.has(file.path)}
                          onChange={(e) => toggleContextPath(file.path, e.target.checked)}
                        />
                        <span>
                          <span className="font-medium">{file.label}</span>
                          <span className="ml-1 text-muted-foreground">({file.category})</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {canFanOut ? (
            <Button
              type="button"
              variant="outline"
              className="h-7 w-full text-xs"
              disabled={fanOutRunning || loading || action === "custom"}
              title="Draft all units in this section sequentially"
              onClick={() => void handleFanOut()}
            >
              Draft all units in section
            </Button>
          ) : null}

          {/* Prompt preview */}
          {preview && (
            <details className="text-xs">
              <summary className="cursor-pointer select-none text-muted-foreground">Prompt preview</summary>
              <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed">
                {preview.prompt}
              </pre>
            </details>
          )}

          {/* Command + action buttons */}
          <div className="flex flex-col gap-2">
            <textarea
              className={cn(
                "min-h-[4.5rem] w-full resize-y rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-xs leading-relaxed",
                !preview && "text-muted-foreground",
              )}
              rows={3}
              value={preview ? editedCommand : "— preview first —"}
              readOnly={!preview}
              onChange={(e) => setEditedCommand(e.target.value)}
            />
            <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Preview prompt"
              disabled={loading || (!isUnit && !canFanOut)}
              onClick={() => void handlePreview(false)}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={preview ? "default" : "outline"}
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Run in terminal"
              disabled={loading || (!isUnit && !canFanOut)}
              onClick={handleRun}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            </div>
          </div>

          {/* Session history */}
          {sessions.length > 0 && (
            <div className="rounded-sm border border-border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/40"
                onClick={() => setSessionsOpen((v) => !v)}
              >
                {sessionsOpen ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <Clock className="h-3 w-3 shrink-0" />
                <span>{sessions.length} previous session{sessions.length !== 1 ? "s" : ""}</span>
              </button>

              {sessionsOpen && (
                <ul className="max-h-48 overflow-auto border-t border-border">
                  {sessions.map((s) => (
                    <li key={s.filename} className="border-b border-border/50 px-2 py-1.5 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={cn("mr-1 text-[10px]", STATUS_COLOR[s.status])}>
                            {STATUS_ICON[s.status]}
                          </span>
                          <span className="text-xs font-medium">{s.action}</span>
                          <span className="mx-1 text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">{s.provider}</span>
                          <span className="mx-1 text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{formatAt(s.at)}</span>
                        </div>
                        {s.status === "dispatched" && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              title="Mark complete"
                              className="rounded-sm p-0.5 hover:bg-accent"
                              onClick={() => void handleMarkStatus(s, "complete")}
                            >
                              <Check className="h-3 w-3 text-success" />
                            </button>
                            <button
                              type="button"
                              title="Mark skipped"
                              className="rounded-sm p-0.5 hover:bg-accent"
                              onClick={() => void handleMarkStatus(s, "skipped")}
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                      </div>
                      {s.status === "dispatched" && (
                        <p className="mt-0.5 text-ui-2xs text-warning">
                          ⚠ Not yet marked complete — was this session finished?
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
