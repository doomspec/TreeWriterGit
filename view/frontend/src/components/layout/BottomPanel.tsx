import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, PanelBottomClose, RefreshCw, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DispatchHistoryStrip } from "@/components/dispatch/DispatchHistoryStrip";
import {
  DispatchWorkspace,
  type DispatchPaneTab,
} from "@/components/dispatch/DispatchWorkspace";
import type { AgentDispatchIntent } from "@/lib/agentDispatchPanel";
import { useDispatchSessions } from "@/lib/useDispatchSessions";
import {
  BOTTOM_PANEL_HEIGHT_MAX,
  BOTTOM_PANEL_HEIGHT_MIN,
  clampBottomPanelHeight,
} from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

export type { DispatchPaneTab };

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
  height,
  onHeightChange,
  isUnit = false,
  canFanOut = false,
  dispatchIntent = null,
  onDispatchIntentConsumed,
  initialDispatchTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  refreshVersion: number;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onReconnect: () => void;
  onLayoutChange?: () => void;
  terminalHostRef: React.Ref<HTMLDivElement | null>;
  height: number;
  onHeightChange: (height: number) => void;
  isUnit?: boolean;
  canFanOut?: boolean;
  dispatchIntent?: AgentDispatchIntent | null;
  onDispatchIntentConsumed?: () => void;
  initialDispatchTab?: DispatchPaneTab;
}) {
  const [dispatchTab, setDispatchTab] = useState<DispatchPaneTab>("run");
  const [selectedSessionFilename, setSelectedSessionFilename] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [previewCommand, setPreviewCommand] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [resizing, setResizing] = useState(false);

  const { sessions, reload, markStatus } = useDispatchSessions(currentPath, refreshVersion);

  const onResizePointerMove = useCallback(
    (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      onHeightChange(clampBottomPanelHeight(rect.bottom - event.clientY));
    },
    [onHeightChange],
  );

  useEffect(() => {
    if (!resizing) return;
    let raf: number | undefined;
    const onMove = (event: PointerEvent) => {
      onResizePointerMove(event);
      if (raf !== undefined) return;
      raf = window.requestAnimationFrame(() => {
        raf = undefined;
        onLayoutChange?.();
      });
    };
    const stop = () => setResizing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      if (raf !== undefined) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [onLayoutChange, onResizePointerMove, resizing]);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => onLayoutChange?.());
    return () => window.cancelAnimationFrame(raf);
  }, [dispatchTab, height, onLayoutChange, open]);

  useEffect(() => {
    if (initialDispatchTab) setDispatchTab(initialDispatchTab);
  }, [initialDispatchTab]);

  useEffect(() => {
    if (dispatchIntent) setDispatchTab("run");
  }, [dispatchIntent]);

  const handleOpen = useCallback(
    (dispatchPane?: DispatchPaneTab) => {
      if (dispatchPane) setDispatchTab(dispatchPane);
      onOpenChange(true);
      window.requestAnimationFrame(() => onLayoutChange?.());
    },
    [onLayoutChange, onOpenChange],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) {
    return (
      <div
        className="bottom-panel-rail flex h-auto min-h-8 shrink-0 flex-col border-t border-border bg-sidebar"
        aria-label="Panel collapsed"
      >
        <div className="flex h-8 items-center gap-1 px-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-ui-xs"
            onClick={() => handleOpen()}
          >
            <TerminalSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Terminal
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-ui-xs"
            onClick={() => handleOpen("run")}
          >
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            AI dispatch
          </Button>
        </div>
        <DispatchHistoryStrip
          sessions={sessions}
          currentPath={currentPath}
          onOpenHistory={() => handleOpen("history")}
        />
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="bottom-panel flex shrink-0 flex-col border-t border-border bg-sidebar"
      style={{ height: clampBottomPanelHeight(height) }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={BOTTOM_PANEL_HEIGHT_MIN}
        aria-valuemax={BOTTOM_PANEL_HEIGHT_MAX}
        aria-label="Resize bottom panel"
        tabIndex={0}
        className={cn(
          "bottom-panel__resize-handle shrink-0",
          resizing && "bottom-panel__resize-handle--active",
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizing(true);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 48 : 24;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onHeightChange(clampBottomPanelHeight(height + step));
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onHeightChange(clampBottomPanelHeight(height - step));
          }
        }}
      />

      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2">
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
            onPreviewChange={(preview) => {
              setPreviewPrompt(preview?.prompt ?? null);
              setPreviewCommand(preview?.command ?? null);
            }}
            onSessionsReload={reload}
            sessions={sessions}
            selectedSessionFilename={selectedSessionFilename}
            onSelectSession={(session) => setSelectedSessionFilename(session?.filename ?? null)}
            onMarkStatus={markStatus}
            previewPrompt={previewPrompt}
            previewCommand={previewCommand}
          />
        </section>
      </div>
    </div>
  );
}
