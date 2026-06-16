import { useCallback, useState } from "react";
import { Bot, ChevronDown, ChevronRight, RefreshCw, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DispatchPanel } from "@/DispatchPanel";

export function RightPanel({
  open,
  onOpenChange,
  currentPath,
  refreshVersion,
  onSendToTerminal,
  onError,
  onReconnect,
  onLayoutChange,
  terminalHostRef,
  isUnit = false,
  canFanOut = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  refreshVersion: number;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onReconnect: () => void;
  onLayoutChange?: () => void;
  terminalHostRef: React.RefObject<HTMLDivElement | null>;
  isUnit?: boolean;
  canFanOut?: boolean;
}) {
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  const handleDispatchToggle = useCallback(() => {
    window.requestAnimationFrame(() => onLayoutChange?.());
  }, [onLayoutChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      window.requestAnimationFrame(() => onLayoutChange?.());
    },
    [onLayoutChange, onOpenChange],
  );

  const toggleDispatch = useCallback(() => {
    setDispatchOpen((value) => {
      const next = !value;
      window.requestAnimationFrame(() => onLayoutChange?.());
      return next;
    });
  }, [onLayoutChange]);

  const toggleTerminal = useCallback(() => {
    setTerminalOpen((value) => {
      const next = !value;
      window.requestAnimationFrame(() => onLayoutChange?.());
      return next;
    });
  }, [onLayoutChange]);

  if (!open) {
    return (
      <aside
        className="right-panel right-panel-collapsed flex min-h-0 w-9 shrink-0 flex-col items-center gap-2 border-l border-border bg-[hsl(var(--sidebar-bg))] py-3"
        aria-label="Agent panel collapsed"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Show AI dispatch & terminal"
          aria-label="Show AI dispatch and terminal"
          onClick={() => handleOpenChange(true)}
        >
          <Bot className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Show terminal"
          aria-label="Show terminal"
          onClick={() => handleOpenChange(true)}
        >
          <TerminalSquare className="h-4 w-4" aria-hidden="true" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="right-panel flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-[hsl(var(--sidebar-bg))]">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Agent panel
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          title="Hide agent panel"
          aria-label="Hide AI dispatch and terminal"
          onClick={() => handleOpenChange(false)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border">
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between px-3 text-left hover:bg-accent/40"
            aria-expanded={dispatchOpen}
            onClick={toggleDispatch}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {dispatchOpen ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              AI dispatch
            </span>
          </button>
          {dispatchOpen ? (
            <div className="right-panel-dispatch max-h-[min(38vh,280px)] overflow-y-auto overflow-x-hidden border-t border-border/60">
              <DispatchPanel
                embedded
                currentPath={currentPath}
                refreshVersion={refreshVersion}
                isUnit={isUnit}
                canFanOut={canFanOut}
                onSendToTerminal={onSendToTerminal}
                onError={onError}
                onToggle={handleDispatchToggle}
              />
            </div>
          ) : null}
        </div>

        <div className={cn("flex min-h-0 flex-col overflow-hidden", terminalOpen ? "flex-1" : "shrink-0")}>
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-expanded={terminalOpen}
              onClick={toggleTerminal}
            >
              {terminalOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              )}
              <TerminalSquare className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Terminal
              </span>
            </button>
            {terminalOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Reconnect terminal"
                aria-label="Reconnect terminal"
                onClick={onReconnect}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <div
            className={cn(
              "terminal-host min-h-0 overflow-hidden bg-[#0f1113]",
              terminalOpen ? "flex-1" : "h-0",
            )}
          >
            <div ref={terminalHostRef} className="terminal-mount" />
          </div>
        </div>
      </div>
    </aside>
  );
}
