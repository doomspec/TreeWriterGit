import { useCallback } from "react";
import { Bot, PanelBottomClose, RefreshCw, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DispatchPanel } from "@/components/dispatch/DispatchPanel";

export function BottomPanel({
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
  const handleOpen = useCallback(() => {
    onOpenChange(true);
    window.requestAnimationFrame(() => onLayoutChange?.());
  }, [onLayoutChange, onOpenChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    window.requestAnimationFrame(() => onLayoutChange?.());
  }, [onLayoutChange, onOpenChange]);

  if (!open) {
    return (
      <div
        className="bottom-panel-rail flex h-8 shrink-0 items-center gap-1 border-t border-border bg-sidebar px-2"
        aria-label="Panel collapsed"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-ui-xs"
          onClick={handleOpen}
        >
          <TerminalSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Terminal
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-ui-xs"
          onClick={handleOpen}
        >
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          AI dispatch
        </Button>
      </div>
    );
  }

  return (
    <div className="bottom-panel flex min-h-[12rem] max-h-[min(42vh,480px)] shrink-0 flex-col border-t border-border bg-sidebar">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2">
        <span className="ui-label normal-case">Agent panel</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Hide bottom panel"
          aria-label="Hide bottom panel"
          onClick={handleClose}
        >
          <PanelBottomClose className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="bottom-panel-split min-h-0 flex-1">
        <section className="bottom-panel-pane bottom-panel-pane--terminal flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
            <span className="ui-label flex items-center gap-1.5 normal-case">
              <TerminalSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Terminal
            </span>
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
          </div>
          <div className="terminal-host relative min-h-0 flex-1 overflow-hidden bg-terminal">
            <div ref={terminalHostRef} className="terminal-mount" />
          </div>
        </section>

        <section className="bottom-panel-pane bottom-panel-pane--dispatch flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex h-8 shrink-0 items-center border-b border-border px-3">
            <span className="ui-label flex items-center gap-1.5 normal-case">
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
              AI dispatch
            </span>
          </div>
          <div className="bottom-panel-dispatch min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <DispatchPanel
              embedded
              currentPath={currentPath}
              refreshVersion={refreshVersion}
              isUnit={isUnit}
              canFanOut={canFanOut}
              onSendToTerminal={onSendToTerminal}
              onError={onError}
              onToggle={() => window.requestAnimationFrame(() => onLayoutChange?.())}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
