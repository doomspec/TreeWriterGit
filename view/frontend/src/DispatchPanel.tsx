import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, ChevronRight, Clock, Eye, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

interface AiProvider {
  name: string;
  command: string;
  writesFiles: boolean;
}

type DispatchAction = "draft" | "revise" | "expand" | "cite-check" | "custom" | "refresh-index" | "sync-outline";

const ACTIONS: { value: DispatchAction; label: string }[] = [
  { value: "draft", label: "Draft from outline" },
  { value: "sync-outline", label: "Sync outline from draft" },
  { value: "revise", label: "Revise draft" },
  { value: "expand", label: "Expand draft" },
  { value: "cite-check", label: "Cite-check" },
  { value: "refresh-index", label: "Refresh outline" },
  { value: "custom", label: "Custom" },
];

interface PreviewResult {
  prompt: string;
  command: string;
  outputPath: string;
  sessionId?: string;
}

interface SessionFile {
  filename: string;
  at: string;
  provider: string;
  action: string;
  command: string;
  status: "dispatched" | "complete" | "skipped";
  notes?: string;
  body: string;
}

const STATUS_COLOR: Record<SessionFile["status"], string> = {
  dispatched: "text-yellow-500",
  complete: "text-green-500",
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
}: {
  currentPath: string;
  refreshVersion?: number;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onToggle?: () => void;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(embedded);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [action, setAction] = useState<DispatchAction>("draft");
  const [customPrompt, setCustomPrompt] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [editedCommand, setEditedCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionFile[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const pendingSessionRef = useRef<string | null>(null);
  const previewSessionIdRef = useRef<string>(
    `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  );

  const loadProviders = async () => {
    if (providersLoaded) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/agent/providers`);
      if (!res.ok) throw new Error(`Providers load failed (${res.status})`);
      const data = (await res.json()) as { aiProviders: AiProvider[]; defaultProvider: string };
      setProviders(data.aiProviders);
      setSelectedProvider(data.defaultProvider);
      setProvidersLoaded(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const loadSessions = useCallback(async (unitPath: string) => {
    if (!unitPath) { setSessions([]); return; }
    try {
      const res = await fetch(`${apiBaseUrl}/api/sessions?unitPath=${encodeURIComponent(unitPath)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: SessionFile[] };
      setSessions(data.sessions);
    } catch {
      // non-fatal — sessions are informational
    }
  }, []);

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
        await fetch(`${apiBaseUrl}/api/sessions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitPath: currentPath, filename, status: "complete" }),
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
    setLoading(true);
    setPreview(null);
    setEditedCommand("");
    previewSessionIdRef.current = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      const res = await fetch(`${apiBaseUrl}/api/agent/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitPath: currentPath,
          action,
          provider: selectedProvider,
          customPrompt: action === "custom" ? customPrompt : undefined,
          sessionId: previewSessionIdRef.current,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `Preview failed (${res.status})`);
      }
      const data = (await res.json()) as PreviewResult;
      setPreview(data);
      setEditedCommand(data.command);
      if (runAfter) {
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
      const res = await fetch(`${apiBaseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitPath: currentPath,
          provider: selectedProvider,
          action,
          command,
          status: "dispatched",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { path?: string };
        const filename = data.path?.split("/").pop();
        if (filename) pendingSessionRef.current = filename;
      }
      await loadSessions(currentPath);
    } catch {
      // non-fatal
    }
  };

  const handleRun = () => {
    if (editedCommand && preview) {
      onSendToTerminal(editedCommand + "\n");
      void recordSession(editedCommand);
    } else {
      void handlePreview(true);
    }
  };

  const handleMarkStatus = async (session: SessionFile, status: SessionFile["status"]) => {
    try {
      await fetch(`${apiBaseUrl}/api/sessions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPath: currentPath, filename: session.filename, status }),
      });
      await loadSessions(currentPath);
    } catch {
      // non-fatal
    }
  };

  return (
    <div className="bg-[hsl(var(--sidebar-bg))]">
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
              onChange={(e) => { setSelectedProvider(e.target.value); setPreview(null); setEditedCommand(""); }}
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <select
              className="h-7 w-28 rounded-sm border border-border bg-background px-2 text-xs"
              value={action}
              onChange={(e) => { setAction(e.target.value as DispatchAction); setPreview(null); setEditedCommand(""); }}
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
              disabled={loading || !currentPath}
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
              disabled={loading || !currentPath}
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
                              <Check className="h-3 w-3 text-green-500" />
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
                        <p className="mt-0.5 text-[10px] text-yellow-600">
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
