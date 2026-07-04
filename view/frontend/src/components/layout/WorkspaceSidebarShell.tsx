import { useCallback, useEffect, useRef, useState } from "react";

import type { AppView } from "@/components/commands/AppCommands";
import { SidebarPanelChrome } from "@/components/layout/SidebarPanelChrome";
import { SidebarPanelNav } from "@/components/layout/SidebarPanelNav";
import { SidebarPanelToggleButton } from "@/components/layout/SidebarPanelToggleButton";
import { SidebarRailFooter } from "@/components/layout/SidebarRailFooter";
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
  explorerMode,
  appView,
  gitSync,
  gitStatusLabel,
  connectionState,
  themePreference,
  onSelectPanel,
  onCyclePanelLayout,
  onWidthChange,
  onExplorerModeChange,
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
  explorerMode: boolean;
  appView: AppView;
  gitSync: GitSyncState | null;
  gitStatusLabel: string;
  connectionState: string;
  themePreference: ThemePreference;
  onSelectPanel: (panel: SidebarPanel) => void;
  onCyclePanelLayout: () => void;
  onWidthChange: (width: number) => void;
  onExplorerModeChange: (explorer: boolean) => void;
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
  const effectiveWidth = clampSidebarWidth(sidebarWidth);
  const hoverReveal = panelOpen && !pinned && !readingFocusActive;
  const readingFocusPanelReveal = readingFocusActive && panelOpen;
  const railHoverReveal = hoverReveal || readingFocusPanelReveal;
  const readingFocusRailAutoHide = readingFocusActive;
  const panelVisible = readingFocusPanelReveal
    ? hoverRevealed
    : panelOpen && (pinned || hoverRevealed);
  const railVisible = !readingFocusRailAutoHide || railRevealed || (panelOpen && panelVisible);
  const panelInGrid = panelOpen && pinned && !readingFocusActive;
  // Icon rail is always w-9 — labels use SidebarRailHoverLabel flyouts only.
  const showLabels = false;

  const clearLeaveTimer = useCallback(() => {
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = undefined;
  }, []);

  const scheduleHide = useCallback(() => {
    if (document.body.hasAttribute("data-sidebar-floating-menu-open")) return;
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
      return;
    }
    if (!pinned && !readingFocusActive) {
      setHoverRevealed(true);
    }
  }, [panelOpen, pinned, readingFocusActive, clearLeaveTimer]);

  useEffect(() => {
    if (!readingFocusActive) {
      setRailRevealed(false);
    }
  }, [readingFocusActive]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const handleCyclePanelLayout = useCallback(() => {
    if (!panelOpen) {
      revealPanel();
      if (readingFocusRailAutoHide) revealRail();
    }
    onCyclePanelLayout();
  }, [
    onCyclePanelLayout,
    panelOpen,
    readingFocusRailAutoHide,
    revealPanel,
    revealRail,
  ]);

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
      const main = document.querySelector(".workspace-main");
      if (!main) return;
      const rect = main.getBoundingClientRect();
      onWidthChange(clampSidebarWidth(Math.round(event.clientX - rect.left)));
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

  const utilityFooter = (
    <SidebarRailFooter
      showLabels={showLabels}
      themePreference={themePreference}
      appView={appView}
      onCycleTheme={onCycleTheme}
      onSetAppView={onSetAppView}
    />
  );

  const panelNav = (
    <SidebarPanelNav
      activePanel={activePanel}
      panelOpen={panelOpen}
      graphAvailable={graphAvailable}
      appView={appView}
      showLabels={showLabels}
      pendingReviewCount={pendingReviewCount}
      onSelectPanel={handleSelectPanel}
      onSetAppView={onSetAppView}
    />
  );

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
      <aside
        className={cn(
          "sidebar-collapsed-nav flex min-h-0 w-9 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))]",
          readingFocusRailAutoHide && !railVisible && "pointer-events-none opacity-0",
        )}
        aria-label="Sidebar navigation"
        onPointerEnter={handleRailPointerEnter}
        onPointerLeave={railHoverReveal || readingFocusRailAutoHide ? scheduleHide : undefined}
      >
        <SidebarPanelToggleButton
          panelOpen={panelOpen}
          pinned={pinned}
          onCycle={handleCyclePanelLayout}
          showLabels={showLabels}
        />
        {panelNav}
        {utilityFooter}
      </aside>
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
            <SidebarPanelChrome
              explorerMode={explorerMode}
              onExplorerModeChange={onExplorerModeChange}
              gitSync={gitSync}
              gitStatusLabel={gitStatusLabel}
              connectionState={connectionState}
              onGitClick={onGitClick}
            >
              {panelContent}
            </SidebarPanelChrome>
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
