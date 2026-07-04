import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, FileCode2 } from "lucide-react";

import { ExplorerFileTree } from "@/components/explorer/ExplorerFileTree";
import { ExplorerFileViewer } from "@/components/explorer/ExplorerFileViewer";
import { ExplorerTabs } from "@/components/explorer/ExplorerTabs";
import { MainBibManualEditDialog } from "@/components/editor/MainBibManualEditDialog";
import { clampSidebarWidth, sidebarContentWidth } from "@/components/layout/ResizableSidebarLayout";
import { SidebarPanelChrome } from "@/components/layout/SidebarPanelChrome";
import { SidebarPanelToggleButton } from "@/components/layout/SidebarPanelToggleButton";
import { SidebarRailFooter } from "@/components/layout/SidebarRailFooter";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { useReadingFocus } from "@/lib/readingFocus";
import { useTheme } from "@/lib/useTheme";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider";
import type { GitSyncState } from "@/lib/gitSync";
import { cn } from "@/lib/utils";

function isPapersPath(path: string): boolean {
  return path === "papers" || path.startsWith("papers/");
}

function isMainBibPath(path: string): boolean {
  return path === "main.bib" || path.endsWith("/main.bib");
}

const PAPERS_WARNING_MESSAGE =
  "Editing paper files directly bypasses Writer mode's outline/draft/approval workflow — recommended for experienced users only, changes can affect the written document.";

const HOVER_REVEAL_LEAVE_MS = 220;

/**
 * IDE-style Explorer workspace: a project-root file tree on the left, Chrome
 * tabs plus a CodeMirror editor on the right. Opens any text file type.
 */
export function ExplorerWorkspace({
  gitSync,
  gitStatusLabel,
  connectionState,
  onGitClick,
  pinned,
  sidebarWidth,
  onWidthChange,
}: {
  gitSync: GitSyncState | null;
  gitStatusLabel: string;
  connectionState: string;
  onGitClick: () => void;
  pinned: boolean;
  sidebarWidth: number;
  onWidthChange: (width: number) => void;
}) {
  const ws = useWorkspace();
  const nav = useWorkspaceNavigationContext();
  const readingFocus = useReadingFocus();
  const { preference: themePreference, cyclePreference } = useTheme();
  const shellRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [railRevealed, setRailRevealed] = useState(false);
  const leaveTimerRef = useRef<number | undefined>(undefined);
  const [papersWarningAccepted, setPapersWarningAccepted] = useState(false);
  const [mainBibManualAccepted, setMainBibManualAccepted] = useState(false);
  const [mainBibDialogOpen, setMainBibDialogOpen] = useState(false);

  const panelOpen = nav.sidebarPanelOpen;
  const effectiveWidth = clampSidebarWidth(sidebarWidth);
  const panelInGrid = panelOpen && pinned && !readingFocus.active;

  const clearLeaveTimer = useCallback(() => {
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = undefined;
  }, []);

  const scheduleHideRail = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      setRailRevealed(false);
    }, HOVER_REVEAL_LEAVE_MS);
  }, [clearLeaveTimer]);

  const revealRail = useCallback(() => {
    clearLeaveTimer();
    setRailRevealed(true);
  }, [clearLeaveTimer]);

  useEffect(() => {
    if (!readingFocus.active) {
      setRailRevealed(false);
      clearLeaveTimer();
    }
  }, [readingFocus.active, clearLeaveTimer]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const activeTab = ws.explorerActiveTab;
  const isPapersFile = activeTab != null && isPapersPath(activeTab);
  const isMainBibFile = activeTab != null && isMainBibPath(activeTab);
  const showPapersConfirm = isPapersFile && !papersWarningAccepted;
  const showMainBibConfirm = isMainBibFile && !mainBibManualAccepted && !mainBibDialogOpen;

  useEffect(() => {
    if (isMainBibFile && !mainBibManualAccepted) {
      setMainBibDialogOpen(true);
    }
  }, [isMainBibFile, mainBibManualAccepted, activeTab]);

  const canShowEditor =
    activeTab &&
    (!isPapersFile || papersWarningAccepted) &&
    (!isMainBibFile || mainBibManualAccepted);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
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

  return (
    <>
      <ConfirmDialog
        open={showPapersConfirm}
        title="Edit paper files in Explorer?"
        message={PAPERS_WARNING_MESSAGE}
        confirmLabel="Proceed anyway"
        onConfirm={() => setPapersWarningAccepted(true)}
        onCancel={() => {
          if (activeTab) ws.closeExplorerTab(activeTab);
        }}
      />
      <MainBibManualEditDialog
        open={mainBibDialogOpen && isMainBibFile && !mainBibManualAccepted}
        onOpenReferenceManager={() => {
          setMainBibDialogOpen(false);
          if (activeTab) ws.closeExplorerTab(activeTab);
          ws.setExplorerMode(false);
          nav.setSidebarPanel("references");
          nav.setSidebarPanelOpen(true);
          nav.openFile("main.bib");
        }}
        onProceedManually={() => {
          setMainBibManualAccepted(true);
          setMainBibDialogOpen(false);
        }}
        onCancel={() => {
          setMainBibDialogOpen(false);
          if (activeTab) ws.closeExplorerTab(activeTab);
        }}
      />
      <div
        ref={shellRef}
        className={cn(
          "workspace-main min-h-0 min-w-0 flex-1 bg-background",
          !panelInGrid && "workspace-main--sidebar-collapsed",
        )}
        style={
          {
            "--sidebar-width": `${effectiveWidth}px`,
            "--sidebar-content-width": `${sidebarContentWidth(effectiveWidth)}px`,
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "workspace-sidebar-shell min-h-0 min-w-0",
            panelOpen && "workspace-sidebar-shell--open",
            panelOpen && !panelInGrid && "workspace-sidebar-shell--revealed",
            readingFocus.active && panelOpen && "workspace-sidebar-shell--reading-focus",
            readingFocus.active && railRevealed && "workspace-sidebar-shell--rail-revealed",
          )}
          onPointerEnter={readingFocus.active ? revealRail : undefined}
          onPointerLeave={readingFocus.active ? scheduleHideRail : undefined}
        >
          {readingFocus.active ? (
            <div
              className="reading-focus-rail-hover-zone"
              onPointerEnter={revealRail}
              aria-hidden="true"
            />
          ) : null}
          <aside className="sidebar-collapsed-nav flex min-h-0 w-9 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))]">
            <SidebarPanelToggleButton
              panelOpen={panelOpen}
              pinned={pinned}
              onCycle={nav.cycleSidebarPanelLayout}
            />
            <div className="min-h-0 flex-1" aria-hidden="true" />
            <SidebarRailFooter
              themePreference={themePreference}
              appView={ws.appView}
              onCycleTheme={cyclePreference}
              onSetAppView={ws.setAppView}
            />
          </aside>
          {panelOpen ? (
            <>
              <aside
                className={cn(
                  "workspace-sidebar-shell__panel min-h-0 min-w-0 overflow-hidden",
                  !panelInGrid && "workspace-sidebar-shell__panel--overlay workspace-sidebar-shell__panel--visible",
                )}
              >
                <SidebarPanelChrome
                  explorerMode
                  onExplorerModeChange={ws.setExplorerMode}
                  gitSync={gitSync}
                  gitStatusLabel={gitStatusLabel}
                  connectionState={connectionState}
                  onGitClick={onGitClick}
                >
                  <ExplorerFileTree
                    activeFile={activeTab}
                    onOpenFile={ws.openExplorerTab}
                    onError={ws.setError}
                    onPathChange={ws.applyExplorerPathChange}
                  />
                </SidebarPanelChrome>
              </aside>
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
        <div className="workspace-main__main flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className={cn("w-full shrink-0", readingFocus.active && "editor-chrome-hidden")}>
          <ExplorerTabs
            tabs={ws.explorerOpenTabs}
            activeTab={activeTab}
            onSelect={ws.setExplorerActiveTab}
            onClose={ws.closeExplorerTab}
            onCloseAll={ws.closeAllExplorerTabs}
          />
        </div>
        {isPapersFile && papersWarningAccepted ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-950 dark:text-amber-100",
              readingFocus.active && "editor-chrome-hidden",
            )}
            role="status"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{PAPERS_WARNING_MESSAGE}</span>
          </div>
        ) : null}
        {canShowEditor ? (
          <ExplorerFileViewer key={activeTab} path={activeTab} onError={ws.setError} />
        ) : showMainBibConfirm ? null : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileCode2 className="h-8 w-8 opacity-40" aria-hidden="true" />
            <p className="text-sm">Select a file from the Explorer to start editing.</p>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
