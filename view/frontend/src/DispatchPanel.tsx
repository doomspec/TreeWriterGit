import { useState } from "react";
import { Bot, ChevronDown, ChevronRight, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

interface AiProvider {
  name: string;
  command: string;
  writesFiles: boolean;
}

type DispatchAction = "draft" | "revise" | "expand" | "cite-check" | "custom";

const ACTIONS: { value: DispatchAction; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "revise", label: "Revise" },
  { value: "expand", label: "Expand" },
  { value: "cite-check", label: "Cite-check" },
  { value: "custom", label: "Custom" },
];

interface PreviewResult {
  prompt: string;
  command: string;
  outputPath: string;
}

export function DispatchPanel({
  currentPath,
  onSendToTerminal,
  onError,
}: {
  currentPath: string;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [action, setAction] = useState<DispatchAction>("draft");
  const [customPrompt, setCustomPrompt] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [editedCommand, setEditedCommand] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleToggle = () => {
    setOpen((v) => {
      if (!v) void loadProviders();
      return !v;
    });
  };

  const handlePreview = async (runAfter = false): Promise<void> => {
    if (!currentPath) {
      onError("Navigate to a unit first");
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/agent/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitPath: currentPath,
          action,
          provider: selectedProvider,
          customPrompt: action === "custom" ? customPrompt : undefined,
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
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRun = () => {
    if (editedCommand) {
      onSendToTerminal(editedCommand + "\n");
    } else {
      void handlePreview(true);
    }
  };

  return (
    <div className="border-b border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent/50"
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

      {open && (
        <div className="space-y-2 px-3 pb-3">
          {/* Provider + action selectors */}
          <div className="flex gap-2">
            <select
              className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-xs"
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
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
            <select
              className="h-7 w-28 rounded-sm border border-border bg-background px-2 text-xs"
              value={action}
              onChange={(e) => {
                setAction(e.target.value as DispatchAction);
                setPreview(null);
                setEditedCommand("");
              }}
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom prompt textarea */}
          {action === "custom" && (
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
          )}

          {/* Prompt preview (collapsible) */}
          {preview && (
            <details className="text-xs">
              <summary className="cursor-pointer select-none text-muted-foreground">
                Prompt preview
              </summary>
              <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed">
                {preview.prompt}
              </pre>
            </details>
          )}

          {/* Command row */}
          <div className="flex items-center gap-2">
            <input
              className={cn(
                "h-7 flex-1 rounded-sm border border-border bg-background px-2 font-mono text-xs",
                !preview && "text-muted-foreground",
              )}
              value={preview ? editedCommand : "— preview first —"}
              readOnly={!preview}
              onChange={(e) => setEditedCommand(e.target.value)}
              placeholder="command…"
            />
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
      )}
    </div>
  );
}
