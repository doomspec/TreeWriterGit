import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

const SettingsPage = lazy(() =>
  import("@/components/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const InfoPage = lazy(() =>
  import("@/components/help/InfoPage").then((m) => ({ default: m.InfoPage })),
);
const GraphPanel = lazy(() =>
  import("@/components/graph/GraphPanel").then((m) => ({ default: m.GraphPanel })),
);
import { AppChromeHeader } from "@/components/layout/AppChromeHeader";
import { BottomPanel, type DispatchPaneTab } from "@/components/layout/BottomPanel";
import { WorkspaceSidebarShell } from "@/components/layout/WorkspaceSidebarShell";
import { WorkspaceNav } from "@/components/nav/WorkspaceNav";
import { DocumentOutlinePanel } from "@/components/nav/DocumentOutlinePanel";
import { PaperExportPanel } from "@/components/paper/PaperExportPanel";
import { DocxImportPanel } from "@/components/paper/DocxImportPanel";
import { WorkspaceRouter } from "@/components/workspace/WorkspaceRouter";
import { ErrorToast } from "@/components/layout/ErrorToast";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { DocumentOutlineProvider } from "@/lib/documentOutline";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { parentPath, PAPERS_ROOT } from "@/lib/modelTree";
import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { gitSyncHasError, isViewSyncPaused } from "@/lib/gitSync";
import { resolveViewSyncWithHarness } from "@/lib/agentDispatchClient";
import { AgentDispatchPanelContext } from "@/lib/agentDispatchPanel";
import { useGitSyncState } from "@/lib/useGitSyncState";
import { useTerminalSession } from "@/lib/useTerminalSession";
import { useTheme } from "@/lib/useTheme";
import { useReadingFocus } from "@/lib/readingFocus";
import { AppCommands } from "@/components/commands/AppCommands";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace/WorkspaceProvider";
import { useWorkspaceLayout } from "@/lib/workspace/WorkspaceLayoutContext";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import { cn } from "@/lib/utils";
import { DEFAULT_GUIDE_PAPER_SLUG } from "@/lib/defaultGuidePaper";
import {
  applyEditorPanePreset,
  focusEditorPane,
  type EditorPaneId,
  type EditorPanePresetId,
} from "@/lib/editorVisiblePanes";

export function AppRoot() {
  const errorRef = useRef<(message: string) => void>(() => {});
  const {
    gitSync,
    loadGitSyncStatus,
    runGitSync,
    handleGitSyncSettingsChange,
    handleGitBadgeClick,
    gitStatusLabel,
  } = useGitSyncState({ onError: (message) => errorRef.current(message) });

  const onModelEventsRefresh = useCallback(() => {
    loadGitSyncStatus().catch(() => {});
  }, [loadGitSyncStatus]);

  return (
    <WorkspaceProvider onModelEventsRefresh={onModelEventsRefresh}>
      <AppShell
        errorRef={errorRef}
        gitSync={gitSync}
        runGitSync={runGitSync}
        handleGitSyncSettingsChange={handleGitSyncSettingsChange}
        handleGitBadgeClick={handleGitBadgeClick}
        gitStatusLabel={gitStatusLabel}
      />
    </WorkspaceProvider>
  );
}

function AppShell({
  errorRef,
  gitSync,
  runGitSync,
  handleGitSyncSettingsChange,
  handleGitBadgeClick,
  gitStatusLabel,
}: {
  errorRef: React.MutableRefObject<(message: string) => void>;
  gitSync: ReturnType<typeof useGitSyncState>["gitSync"];
  runGitSync: ReturnType<typeof useGitSyncState>["runGitSync"];
  handleGitSyncSettingsChange: ReturnType<typeof useGitSyncState>["handleGitSyncSettingsChange"];
  handleGitBadgeClick: ReturnType<typeof useGitSyncState>["handleGitBadgeClick"];
  gitStatusLabel: ReturnType<typeof useGitSyncState>["gitStatusLabel"];
}) {
  const ws = useWorkspace();
  const layout = useWorkspaceLayout();
  const nav = useWorkspaceNavigationContext();

  useEffect(() => {
    errorRef.current = ws.setError;
  }, [errorRef, ws.setError]);
  const readingFocus = useReadingFocus();

  useEffect(() => {
    if (readingFocus.active) {
      nav.setSidebarPanelOpen(false);
    }
  }, [nav.setSidebarPanelOpen, readingFocus.active]);
  const { preference: themePreference, setPreference: setThemePreference, cyclePreference } =
    useTheme();
  const [agentPanelFocus, setAgentPanelFocus] = useState<"terminal" | "dispatch" | null>(null);
  const [requestedDispatchTab, setRequestedDispatchTab] = useState<DispatchPaneTab | undefined>(
    undefined,
  );

  const {
    terminalHostRef,
    connectionState,
    sendToTerminal,
    sendToTerminalWhenReady,
    refitTerminal,
    reconnectTerminal,
  } = useTerminalSession({
    enabled: layout.agentPanelOpen,
    refitTriggers: useMemo(
      () => [
        nav.sidebarTab,
        nav.currentPath,
        nav.activeFile,
        layout.agentPanelOpen,
        layout.sidebarWidth,
        layout.bottomPanelHeight,
      ],
      [
        nav.sidebarTab,
        nav.currentPath,
        nav.activeFile,
        layout.agentPanelOpen,
        layout.sidebarWidth,
        layout.bottomPanelHeight,
      ],
    ),
  });

  const openAgentPanel = useCallback(() => {
    setAgentPanelFocus("terminal");
    layout.setAgentPanelOpen(true);
    refitTerminal();
  }, [layout, refitTerminal]);

  const openAgentDispatch = useCallback(
    (intent: Parameters<typeof nav.setDispatchIntent>[0]) => {
      setAgentPanelFocus("dispatch");
      setRequestedDispatchTab("run");
      layout.setAgentPanelOpen(true);
      nav.setDispatchIntent(intent);
      refitTerminal();
    },
    [layout, nav, refitTerminal],
  );

  const openTerminalPanel = useCallback(() => {
    if (layout.agentPanelOpen && agentPanelFocus === "terminal") {
      layout.setAgentPanelOpen(false);
      setAgentPanelFocus(null);
      return;
    }
    setAgentPanelFocus("terminal");
    setRequestedDispatchTab(undefined);
    layout.setAgentPanelOpen(true);
    refitTerminal();
  }, [agentPanelFocus, layout, refitTerminal]);

  const openDispatchPanel = useCallback(() => {
    if (layout.agentPanelOpen && agentPanelFocus === "dispatch") {
      layout.setAgentPanelOpen(false);
      setAgentPanelFocus(null);
      return;
    }
    setAgentPanelFocus("dispatch");
    setRequestedDispatchTab("run");
    layout.setAgentPanelOpen(true);
    refitTerminal();
  }, [agentPanelFocus, layout, refitTerminal]);

  const handleAgentPanelOpenChange = useCallback(
    (open: boolean) => {
      layout.setAgentPanelOpen(open);
      if (!open) setAgentPanelFocus(null);
    },
    [layout],
  );

  const agentDispatchPanelValue = useMemo(
    () => ({ openDispatch: openAgentDispatch }),
    [openAgentDispatch],
  );

  const resolveViewSyncHarness = useCallback(async () => {
    try {
      ws.setAppView("workspace");
      openAgentPanel();
      refitTerminal();
      await resolveViewSyncWithHarness({ submitToTerminal: sendToTerminalWhenReady });
    } catch (err) {
      ws.setError(err instanceof Error ? err.message : String(err));
    }
  }, [openAgentPanel, refitTerminal, sendToTerminalWhenReady, ws]);

  const viewSyncPaused = isViewSyncPaused(gitSync);

  const homeTitle = useMemo(() => {
    const slug = nav.lastPaperPath ? paperSlugFromPath(nav.lastPaperPath) : null;
    return slug ? `Open ${slug} paper` : "Home";
  }, [nav.lastPaperPath]);

  const handleNavigateUp = useCallback(() => {
    nav.navigateTo(parentPath(nav.browsePath));
  }, [nav]);

  const handleHome = useCallback(() => {
    ws.setAppView("workspace");
    nav.handleSidebarTabChange("papers");
    nav.setSidebarPanel("papers");
    nav.navigateTo(nav.lastPaperPath ?? PAPERS_ROOT);
  }, [nav, ws]);

  const handleFocusEditorPane = useCallback(
    (pane: EditorPaneId) => {
      const next = focusEditorPane(layout.editorVisiblePanes, pane, layout.dualPaneActive);
      layout.setEditorVisiblePanes(next.visible);
      layout.setDualPaneActive(next.active);
    },
    [layout],
  );

  const handleApplyEditorPanePreset = useCallback(
    (preset: EditorPanePresetId) => {
      const next = applyEditorPanePreset(preset, nav.notesPaneAvailable);
      layout.setEditorVisiblePanes(next.visible);
      layout.setDualPaneActive(next.active);
    },
    [layout, nav.notesPaneAvailable],
  );

  const canFocusBack = nav.showPaperViewBack || nav.showSectionViewBack || nav.canGoUp;
  const handleFocusBack = useCallback(() => {
    if (nav.showPaperViewBack || nav.showSectionViewBack) {
      nav.backToSectionView();
      return;
    }
    if (nav.canGoUp) {
      nav.navigateTo(parentPath(nav.browsePath));
    }
  }, [nav]);

  const focusBackTitle = nav.showPaperViewBack
    ? "Back to paper view"
    : nav.showSectionViewBack
      ? "Back to section view"
      : "Back";

  const createChild = (kind: typeof nav.containerKind) => {
    nav.setCreatePrompt({ kind });
  };

  const sidebarInGrid =
    nav.sidebarPanelOpen && nav.sidebarPinned && !readingFocus.active;

  return (
    <AgentDispatchPanelContext.Provider value={agentDispatchPanelValue}>
        <DocumentOutlineProvider>
        <main
          className={cn(
            "flex h-screen flex-col overflow-hidden bg-background text-foreground",
            readingFocus.active && "reading-focus-mode",
          )}
        >
          <AppChromeHeader
            appView={ws.appView}
            browsePath={nav.browsePath}
            onNavigate={nav.navigateTo}
            breadcrumbVariant={nav.sidebarTab === "papers" ? "papers" : "default"}
            tree={nav.tree}
            refreshVersion={nav.refreshVersion}
            onOpenFile={nav.openFile}
            paperPath={nav.paperPath}
            searchQuery={nav.searchQuery}
            onSearchChange={nav.setSearchQuery}
            onSearchSelect={nav.handleSearchSelect}
            onRefreshModel={() => nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined)}
            onHomeClick={handleHome}
            homeTitle={homeTitle}
            canBack={canFocusBack}
            onBack={handleFocusBack}
            backTitle={focusBackTitle}
          />
          <AppCommands
            appView={ws.appView}
            sidebarTab={nav.sidebarTab}
            editorLayout={layout.editorLayout}
            canGoUp={nav.canGoUp}
            canCreateUnit={nav.canCreateUnit}
            canCreateSection={nav.canCreateFolder && nav.containerKind === "section"}
            canCreateSubsection={nav.canCreateFolder && nav.containerKind === "subsection"}
            showSectionViewBack={nav.showSectionViewBack || nav.showPaperViewBack}
            dualPaneEditorActive={nav.dualPaneEditorActive}
            notesPaneAvailable={nav.notesPaneAvailable}
            onSetAppView={ws.setAppView}
            onSetSidebarTab={nav.handleSidebarTabChange}
            onSetSidebarPanel={nav.setSidebarPanel}
            onToggleSidebarPanel={nav.toggleSidebarPanel}
            onNavigateUp={handleNavigateUp}
            onBack={nav.backToSectionView}
            onCreateChild={createChild}
            onRefreshModel={() =>
              nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined)
            }
            onToggleBottomPanel={() => layout.setAgentPanelOpen((open) => !open)}
            onToggleReadingFocus={readingFocus.toggle}
            onSetEditorLayout={layout.setEditorLayout}
            onGitSync={() => void runGitSync()}
            onCycleTheme={cyclePreference}
            onFocusEditorPane={handleFocusEditorPane}
            onApplyEditorPanePreset={handleApplyEditorPanePreset}
          />

          {ws.appView === "settings" ? (
            <Suspense fallback={<LoadingSkeleton className="p-6" lines={6} />}>
              <SettingsPage
                onBack={() => ws.setAppView("workspace")}
                onError={ws.setError}
                onGitSyncChange={handleGitSyncSettingsChange}
                viewSyncPaused={viewSyncPaused}
                onResolveViewSync={() => void resolveViewSyncHarness()}
                themePreference={themePreference}
                onThemePreferenceChange={setThemePreference}
              />
            </Suspense>
          ) : ws.appView === "info" ? (
            <Suspense fallback={<LoadingSkeleton className="p-6" lines={6} />}>
              <InfoPage
              onBack={() => ws.setAppView("workspace")}
              onOpenInPapers={() => {
                ws.setAppView("workspace");
                nav.handleSidebarTabChange("papers");
                nav.setSidebarPanel("papers");
                nav.navigateTo(`papers/${DEFAULT_GUIDE_PAPER_SLUG}`);
              }}
              filesCount={nav.files.length}
              commentSummary={nav.commentSummary}
              assignedComments={nav.assignedComments}
              paperSlug={nav.paperSlug}
              gitSync={gitSync}
              viewSyncPaused={viewSyncPaused}
              onResolveViewSync={() => void resolveViewSyncHarness()}
              />
            </Suspense>
          ) : (
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                readingFocus.active && "reading-focus-shell",
              )}
            >
              <div className="reading-focus-shell__main flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="workspace-shell flex min-h-0 min-w-0 flex-1 flex-col">
                <div
                  className={cn(
                    "workspace-main min-h-0 flex-1",
                    !sidebarInGrid && "workspace-main--sidebar-collapsed",
                  )}
                  style={
                    {
                      "--sidebar-rail-width": "36px",
                      "--sidebar-width": `${layout.sidebarWidth}px`,
                    } as React.CSSProperties
                  }
                >
                  <WorkspaceSidebarShell
                    activePanel={nav.sidebarPanel}
                    panelOpen={nav.sidebarPanelOpen}
                    pinned={nav.sidebarPinned}
                    readingFocusActive={readingFocus.active}
                    graphAvailable={Boolean(nav.graphFetchRoot)}
                    sidebarWidth={layout.sidebarWidth}
                    agentPanelOpen={layout.agentPanelOpen}
                    agentPanelFocus={agentPanelFocus}
                    appView={ws.appView}
                    gitSync={gitSync}
                    gitStatusLabel={gitStatusLabel}
                    connectionState={connectionState}
                    themePreference={themePreference}
                    onSelectPanel={nav.setSidebarPanel}
                    onTogglePanel={nav.toggleSidebarPanel}
                    onTogglePin={nav.toggleSidebarPin}
                    onWidthChange={layout.setSidebarWidth}
                    onOpenTerminalPanel={openTerminalPanel}
                    onOpenDispatchPanel={openDispatchPanel}
                    onGitClick={handleGitBadgeClick}
                    onSetAppView={ws.setAppView}
                    onCycleTheme={cyclePreference}
                    panelContent={
                      nav.sidebarPanel === "outline" ? (
                        <DocumentOutlinePanel className="h-full" />
                      ) : nav.sidebarPanel === "graph" ? (
                        <div className="graph-tab-host flex h-full min-h-[200px] flex-col overflow-hidden">
                          <Suspense fallback={<LoadingSkeleton className="p-3" lines={4} />}>
                            <GraphPanel
                              embedded
                              active
                              fetchRoot={nav.graphFetchRoot ?? ""}
                              focusPath={nav.graphFocusPath}
                              graphScope={nav.graphScope}
                              refreshVersion={nav.refreshVersion}
                              onGraphScopeChange={nav.setGraphScope}
                              onSelectNode={(id) => {
                                if (id.startsWith("missing:")) return;
                                nav.navigateTo(id);
                              }}
                            />
                          </Suspense>
                        </div>
                      ) : nav.sidebarPanel === "export" ? (
                        <PaperExportPanel
                          className="h-full"
                          paperSlug={nav.exportPaperSlug}
                          onError={ws.setError}
                          onComplete={() =>
                            nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined)
                          }
                        />
                      ) : nav.sidebarPanel === "import" ? (
                        <DocxImportPanel
                          className="h-full"
                          paperSlug={nav.exportPaperSlug}
                          onError={ws.setError}
                          onComplete={() =>
                            nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined)
                          }
                        />
                      ) : (
                        <WorkspaceNav
                          tree={nav.tree}
                          currentPath={nav.browsePath}
                          activeFile={nav.activeFile}
                          activeTab={nav.sidebarPanel === "papers" ? "papers" : "explorer"}
                          searchQuery={nav.searchQuery}
                          refreshVersion={nav.refreshVersion}
                          onSearchChange={nav.setSearchQuery}
                          onNavigate={nav.navigateTo}
                          onOpenFile={nav.openFile}
                          onSearchSelect={nav.handleSearchSelect}
                          onLoadSubtree={nav.loadTreePath}
                          onPaperCreated={(path) => {
                            nav.reloadModel({ path: path.split("/").slice(0, 2).join("/") || path });
                            nav.navigateTo(path);
                            nav.handleSidebarTabChange("papers");
                          }}
                          onModelChanged={() =>
                            nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined)
                          }
                          onError={ws.setError}
                        />
                      )
                    }
                  />
                  <div className="workspace-main__main flex min-h-0 min-w-0 flex-col">
                  <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-workspace">
                    <WorkspaceRouter
                      onError={ws.setError}
                      onSendToTerminal={sendToTerminal}
                      onBeforeDispatch={openAgentPanel}
                      onDispatchComplete={() =>
                        nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined)
                      }
                    />
                  </section>
                  <BottomPanel
                    open={layout.agentPanelOpen}
                    onOpenChange={handleAgentPanelOpenChange}
                    currentPath={nav.browsePath}
                    refreshVersion={nav.refreshVersion}
                    height={layout.bottomPanelHeight}
                    onHeightChange={layout.setBottomPanelHeight}
                    isUnit={nav.isUnit}
                    canFanOut={nav.isPaperSection && !nav.isUnit}
                    dispatchIntent={nav.dispatchIntent}
                    initialDispatchTab={
                      requestedDispatchTab ?? (nav.dispatchIntent ? "run" : undefined)
                    }
                    onDispatchIntentConsumed={nav.clearDispatchIntent}
                    onSendToTerminal={sendToTerminal}
                    onError={ws.setError}
                    onReconnect={reconnectTerminal}
                    onLayoutChange={refitTerminal}
                    terminalHostRef={terminalHostRef}
                  />
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          <NamePromptDialog
            open={nav.createPrompt !== null}
            title={nav.createPrompt ? `New ${nav.createPrompt.kind}` : "New node"}
            label="Folder-safe name (lowercase, hyphens ok)"
            confirmLabel="Create"
            onConfirm={(name) => void nav.submitCreateChild(name)}
            onCancel={() => nav.setCreatePrompt(null)}
          />

          {ws.error ? (
            <ErrorToast message={ws.error} onDismiss={() => ws.setError(null)}>
              {gitSyncHasError(gitSync) ? (
                <button type="button" className="underline" onClick={() => void runGitSync()}>
                  retry sync
                </button>
              ) : null}
              {viewSyncPaused ? (
                <button type="button" className="underline" onClick={() => void resolveViewSyncHarness()}>
                  resolve with harness
                </button>
              ) : null}
            </ErrorToast>
          ) : null}
        </main>
        </DocumentOutlineProvider>
    </AgentDispatchPanelContext.Provider>
  );
}

