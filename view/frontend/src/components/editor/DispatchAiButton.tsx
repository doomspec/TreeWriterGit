import { useState } from "react";
import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DispatchProgressState } from "@/lib/agentDispatchClient";
import { cn } from "@/lib/utils";

type DispatchAiButtonProps = {
  actionLabel: string;
  dispatching: boolean;
  progress: DispatchProgressState | null;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
};

export function DispatchAiButton({
  actionLabel,
  dispatching,
  progress,
  disabled,
  className,
  onClick,
}: DispatchAiButtonProps) {
  const [hovering, setHovering] = useState(false);
  const activeProgress =
    progress && progress.phase !== "idle" ? progress : null;
  const isRunning = dispatching || activeProgress?.phase === "running";
  const showHint = hovering || isRunning;

  const pct =
    activeProgress && activeProgress.total > 0
      ? Math.round((activeProgress.completed / activeProgress.total) * 100)
      : 0;
  const indeterminate =
    activeProgress &&
    activeProgress.total <= 1 &&
    activeProgress.phase === "running";

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-6 gap-1 px-2 text-[10px]", className)}
        title={`${actionLabel} (⌘⇧R)`}
        disabled={disabled ?? dispatching}
        aria-busy={dispatching}
        onClick={onClick}
      >
        <Bot className="h-3 w-3" aria-hidden="true" />
        {dispatching ? "…" : "AI"}
      </Button>

      {showHint ? (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b border-border px-2.5 py-1.5 text-[10px] font-medium">
            {actionLabel}
            <span className="ml-1 font-normal text-muted-foreground">⌘⇧R</span>
          </div>

          {activeProgress && activeProgress.phase !== "idle" ? (
            <>
              <div className="px-2.5 py-2">
                {activeProgress.total > 1 ? (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {activeProgress.completed} / {activeProgress.total}
                      {activeProgress.currentUnit
                        ? ` · ${activeProgress.currentUnit.split("/").pop()}`
                        : ""}
                    </p>
                  </>
                ) : indeterminate ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
                  </div>
                ) : activeProgress.phase === "done" ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full rounded-full bg-primary" />
                  </div>
                ) : null}
              </div>
              <div className="max-h-36 overflow-y-auto border-t border-border px-2.5 py-1.5 font-mono text-[9px] leading-relaxed text-muted-foreground">
                {activeProgress.logs.map((line, index) => (
                  <div
                    key={index}
                    className={cn(
                      line.startsWith("✓") && "text-foreground",
                      line.startsWith("✗") && "text-destructive",
                      line.startsWith("▸") && "text-foreground/80",
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="px-2.5 py-2 text-[9px] text-muted-foreground">
              Hover to see dispatch progress and logs.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
