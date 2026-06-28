import { useCallback, useEffect, useRef, useState } from "react";

import type { AppView } from "@/components/commands/AppCommands";
import { SidebarIconRail } from "@/components/layout/SidebarIconRail";
import { SidebarPanelHeader } from "@/components/layout/SidebarPanelHeader";
import { clampSidebarWidth } from "@/components/layout/ResizableSidebarLayout";
import type { GitSyncState } from "@/lib/gitSync";
import type { ThemePreference } from "@/lib/themePreferences";
import { cn } from "@/lib/utils";
import type { SidebarPanel } from "@/lib/workspacePreferences";

const HOVER_REVEAL_LEAVE_MS = 220;

export function WorkspaceSidebarShell({
  activePanel,
  panelOpen,
  pinned,
  readingFocusActive,
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
  onTogglePin,
  onWidthChange,
  onOpenTerminalPanel,
  onOpenDispatchPanel,
  onGitClick,
  onSetAppView,
  onCycleTheme,
  panelContent,
  pendingReviewCount = 0,
  className,
}: {
  activePanel: SidebarPanel;
  panelOpen: boolean;
  pinned: boolean;
  readingFocusActive: boolean;
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
  onTogglePin: () => void;
  onWidthChange: (width: number) => void;
  onOpenTerminalPanel: () => void;
  onOpenDispatchPanel: () => void;
  onGitClick: () => void;
  onSetAppView: (view: AppView) => void;
  onCycleTheme: () => void;
  panelContent: React.ReactNode;
  pendingReviewCount?: number;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [hoverRevealed, setHoverRevealed] = useState(false);
  const [railRevealed, setRailRevealed] = useState(false);
  const leaveTimerRef = useRef<number | undefined>(undefined);
  const effectiveWidth = panelOpen ? clampSidebarWidth(sidebarWidth) : 0;
  const hoverReveal = panelOpen && !pinned && !readingFocusActive;
  const readingFocusPanelReveal = readingFocusActive && panelOpen;
  const railHoverReveal = hoverReveal || readingFocusPanelReveal;
  const readingFocusRailAutoHide = readingFocusActive;
  const panelVisible = readingFocusPanelReveal
    ? hoverRevealed
    : panelOpen && (pinned || hoverRevealed);
  const railVisible = !readingFocusRailAutoHide || railRevealed || (panelOpen && panelVisible);
  const panelInGrid = panelOpen && pinned && !readingFocusActive;

  const clearLeaveTimer = useCallback(() => {
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = undefined;
  }, []);

  const scheduleHide = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      setHoverRevealed(false);
      if (readingFocusRailAutoHide) setRailRevealed(false);
    }, HOVER_REVEAL_LEAVE_MS);
  }, [clearLeaveTimer, readingFocusRailAutoHide]);

  const revealPanel = useCallback(() => {
    clearLeaveTimer();
    setHoverRevealed(true);
  }, [clearLeaveTimer]);

  const revealRail = useCallback(() => {
    clearLeaveTimer();
    setRailRevealed(true);
  }, [clearLeaveTimer]);

  useEffect(() => {
    if (pinned && !readingFocusActive) {
      setHoverRevealed(false);
      clearLeaveTimer();
    }
  }, [pinned, readingFocusActive, clearLeaveTimer]);

  useEffect(() => {
    if (!panelOpen) {
      setHoverRevealed(false);
      clearLeaveTimer();
    }
  }, [panelOpen, clearLeaveTimer]);

  useEffect(() => {
    if (!readingFocusActive) {
      setRailRevealed(false);
    }
  }, [readingFocusActive]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const handleSelectPanel = useCallback(
    (panel: SidebarPanel) => {
      if (!pinned || readingFocusActive) {
        revealRail();
        revealPanel();
      }
      onSelectPanel(panel);
    },
    [onSelectPanel, pinned, readingFocusActive, revealPanel, revealRail],
  );

  const handleRailPointerEnter = useCallback(() => {
    if (readingFocusRailAutoHide) revealRail();
    if (railHoverReveal) revealPanel();
  }, [railHoverReveal, readingFocusRailAutoHide, revealPanel, revealRail]);

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
        pinned && "workspace-sidebar-shell--pinned",
        hoverReveal && "workspace-sidebar-shell--hover-reveal",
        panelVisible && "workspace-sidebar-shell--revealed",
        readingFocusActive && "workspace-sidebar-shell--reading-focus",
        railVisible && "workspace-sidebar-shell--rail-revealed",
        className,
      )}
    >
      {readingFocusRailAutoHide ? (
        <div
          className="reading-focus-rail-hover-zone"
          aria-hidden="true"
          onPointerEnter={handleRailPointerEnter}
          onPointerLeave={scheduleHide}
        />
      ) : null}
      <SidebarIconRail
        activePanel={activePanel}
        panelOpen={panelOpen}
        pinned={pinned}
        graphAvailable={graphAvailable}
        agentPanelOpen={agentPanelOpen}
        agentPanelFocus={agentPanelFocus}
        appView={appView}
        gitSync={gitSync}
        gitStatusLabel={gitStatusLabel}
        connectionState={connectionState}
        themePreference={themePreference}
        onSelectPanel={handleSelectPanel}
        onTogglePanel={onTogglePanel}
        onTogglePin={onTogglePin}
        onOpenTerminalPanel={onOpenTerminalPanel}
        onOpenDispatchPanel={onOpenDispatchPanel}
        onGitClick={onGitClick}
        onSetAppView={onSetAppView}
        onCycleTheme={onCycleTheme}
        onPointerEnter={handleRailPointerEnter}
        onPointerLeave={railHoverReveal || readingFocusRailAutoHide ? scheduleHide : undefined}
        pendingReviewCount={pendingReviewCount}
      />
      {panelOpen ? (
        <>
          <div
            className={cn(
              "workspace-sidebar-shell__panel min-h-0 min-w-0 overflow-hidden",
              !panelInGrid && "workspace-sidebar-shell__panel--overlay",
              panelVisible && "workspace-sidebar-shell__panel--visible",
            )}
            onPointerEnter={railHoverReveal || readingFocusRailAutoHide ? handleRailPointerEnter : undefined}
            onPointerLeave={railHoverReveal || readingFocusRailAutoHide ? scheduleHide : undefined}
          >
            <SidebarPanelHeader
              gitSync={gitSync}
              gitStatusLabel={gitStatusLabel}
              connectionState={connectionState}
              onGitClick={onGitClick}
              pinned={pinned}
              onTogglePin={onTogglePin}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{panelContent}</div>
          </div>
          {panelInGrid ? (
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
          ) : null}
        </>
      ) : null}
    </div>
  );
}
