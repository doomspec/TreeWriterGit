import { useCallback, useEffect, useState } from "react";
import { PanelBottomClose } from "lucide-react";

import type { AppView } from "@/components/commands/AppCommands";
import { SidebarIconRail } from "@/components/layout/SidebarIconRail";
import { Button } from "@/components/ui/button";
import { SidebarPanelHeader } from "@/components/layout/SidebarPanelHeader";
import { clampSidebarWidth } from "@/components/layout/ResizableSidebarLayout";
import type { GitSyncState } from "@/lib/gitSync";
import type { ThemePreference } from "@/lib/themePreferences";
import { cn } from "@/lib/utils";
import type { SidebarPanel } from "@/lib/workspacePreferences";

export function WorkspaceSidebarShell({
  activePanel,
  panelOpen,
  graphAvailable,
  sidebarWidth,
  agentPanelOpen,
  agentPanelFocus,
  appView,
  gitSync,
  gitStatusLabel,
  connectionState,
  themePreference,
  onSelectPanel,
  onTogglePanel,
  onWidthChange,
  onOpenTerminalPanel,
  onOpenDispatchPanel,
  onCloseAgentPanel,
  onGitClick,
  onSetAppView,
  onCycleTheme,
  panelContent,
  className,
}: {
  activePanel: SidebarPanel;
  panelOpen: boolean;
  graphAvailable: boolean;
  sidebarWidth: number;
  agentPanelOpen: boolean;
  agentPanelFocus: "terminal" | "dispatch" | null;
  appView: AppView;
  gitSync: GitSyncState | null;
  gitStatusLabel: string;
  connectionState: string;
  themePreference: ThemePreference;
  onSelectPanel: (panel: SidebarPanel) => void;
  onTogglePanel: () => void;
  onWidthChange: (width: number) => void;
  onOpenTerminalPanel: () => void;
  onOpenDispatchPanel: () => void;
  onCloseAgentPanel: () => void;
  onGitClick: () => void;
  onSetAppView: (view: AppView) => void;
  onCycleTheme: () => void;
  panelContent: React.ReactNode;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const effectiveWidth = panelOpen ? clampSidebarWidth(sidebarWidth) : 0;

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const shell = document.querySelector(".workspace-sidebar-shell");
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      const railWidth = 36;
      const next = clampSidebarWidth(Math.round(event.clientX - rect.left - railWidth));
      onWidthChange(next);
    },
    [onWidthChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [dragging, onPointerMove]);

  return (
    <div
      className={cn(
        "workspace-sidebar-shell min-h-0 min-w-0",
        panelOpen ? "workspace-sidebar-shell--open" : "workspace-sidebar-shell--collapsed",
        className,
      )}
    >
      <SidebarIconRail
        activePanel={activePanel}
        panelOpen={panelOpen}
        graphAvailable={graphAvailable}
        agentPanelOpen={agentPanelOpen}
        agentPanelFocus={agentPanelFocus}
        appView={appView}
        gitSync={gitSync}
        gitStatusLabel={gitStatusLabel}
        connectionState={connectionState}
        themePreference={themePreference}
        onSelectPanel={onSelectPanel}
        onTogglePanel={onTogglePanel}
        onOpenTerminalPanel={onOpenTerminalPanel}
        onOpenDispatchPanel={onOpenDispatchPanel}
        onGitClick={onGitClick}
        onSetAppView={onSetAppView}
        onCycleTheme={onCycleTheme}
      />
      {panelOpen ? (
        <>
          <div className="workspace-sidebar-shell__panel min-h-0 min-w-0 overflow-hidden">
            <SidebarPanelHeader
              gitSync={gitSync}
              gitStatusLabel={gitStatusLabel}
              connectionState={connectionState}
              onGitClick={onGitClick}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{panelContent}</div>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={effectiveWidth}
            aria-valuemin={180}
            aria-valuemax={520}
            aria-label="Resize sidebar"
            tabIndex={0}
            className={cn(
              "workspace-sidebar-shell__handle resizable-dual-pane__handle",
              dragging && "resizable-dual-pane__handle--active",
            )}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 24 : 12;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                onWidthChange(clampSidebarWidth(effectiveWidth - step));
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                onWidthChange(clampSidebarWidth(effectiveWidth + step));
              }
            }}
          />
        </>
      ) : null}
      {agentPanelOpen ? (
        <div className="workspace-sidebar-shell__bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Hide bottom panel"
            aria-label="Hide bottom panel"
            onClick={onCloseAgentPanel}
          >
            <PanelBottomClose className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
