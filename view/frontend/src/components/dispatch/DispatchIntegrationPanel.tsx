import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildAgentIntegrationPrompt, buildDispatchGuideText } from "@/lib/agentIntegrationPrompt";
import { buildContextCliQuickRef } from "@/lib/dispatchContextGuide";
import { cn } from "@/lib/utils";

type IntegrationTab = "system-prompt" | "dispatch-guide" | "context-cli";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function DispatchIntegrationPanel({
  currentPath,
  previewPrompt,
  previewCommand,
  className,
  hideCurrentPathHint = false,
}: {
  currentPath: string;
  previewPrompt?: string | null;
  previewCommand?: string | null;
  className?: string;
  /** Suppress the "navigate to a unit" footer — irrelevant outside the dispatch panel (e.g. Settings). */
  hideCurrentPathHint?: boolean;
}) {
  const [tab, setTab] = useState<IntegrationTab>("system-prompt");
  const [copied, setCopied] = useState(false);

  const systemPrompt = useMemo(
    () => buildAgentIntegrationPrompt(currentPath || undefined),
    [currentPath],
  );

  const dispatchGuide = useMemo(() => buildDispatchGuideText(), []);
  const contextCliRef = useMemo(() => buildContextCliQuickRef(currentPath || undefined), [currentPath]);

  const activeText =
    tab === "system-prompt"
      ? systemPrompt
      : tab === "context-cli"
        ? contextCliRef
        : previewPrompt?.trim() || previewCommand?.trim() || dispatchGuide;

  const activeLabel =
    tab === "system-prompt"
      ? "System prompt"
      : tab === "context-cli"
        ? "Context CLI"
        : previewPrompt?.trim()
          ? "Latest dispatch prompt"
          : "Dispatch guide";

  useEffect(() => {
    setCopied(false);
  }, [tab, activeText]);

  const handleCopy = () => {
    void copyText(activeText).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex shrink-0 gap-4 border-b border-border px-4">
        {(
          [
            ["system-prompt", "System prompt"],
            ["dispatch-guide", previewPrompt?.trim() ? "Latest prompt" : "Dispatch guide"],
            ["context-cli", "Context CLI"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={cn(
              "-mb-px border-b-2 px-1 py-2.5 text-xs font-medium transition-colors",
              tab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{activeLabel}</span>
          <Button type="button" size="sm" className="h-7 gap-1.5 px-2.5 text-[11px]" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy
              </>
            )}
          </Button>
        </div>

        <textarea
          readOnly
          className="min-h-0 flex-1 resize-none rounded-md border border-border bg-muted/20 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground"
          value={activeText}
          aria-label={activeLabel}
        />

        {hideCurrentPathHint ? null : currentPath ? (
          <p className="shrink-0 text-[11px] text-muted-foreground">
            Context path: <span className="font-mono">{currentPath}</span>
          </p>
        ) : (
          <p className="shrink-0 text-[11px] text-muted-foreground">
            Navigate to a unit folder to include its path in the system prompt.
          </p>
        )}
      </div>
    </div>
  );
}
