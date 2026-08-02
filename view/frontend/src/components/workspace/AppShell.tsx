import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

const SettingsPage = lazy(() =>
  import("@/components/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const InfoPage = lazy(() =>
  import("@/components/help/InfoPage").then((m) => ({ default: m.InfoPage })),
);
import { AppChromeHeader } from "@/components/layout/AppChromeHeader";
import { WorkspaceSidebarShell } from "@/components/layout/WorkspaceSidebarShell";
import { sidebarContentWidth } from "@/components/layout/ResizableSidebarLayout";
import { WorkspaceRouter } from "@/components/workspace/WorkspaceRouter";
import { ExplorerWorkspace } from "@/components/explorer/ExplorerWorkspace";
import { SkillEditorWorkspace } from "@/components/editor/SkillEditorWorkspace";
import { AiAssistantPanelHost } from "@/components/assistant/AiAssistantPanelHost";
import { AiAssistantSplit } from "@/components/assistant/AiAssistantSplit";
import { SidebarPanelRegistry } from "@/components/workspace/sidebar/SidebarPanelRegistry";
import { DocxImportModalProvider } from "@/components/paper/DocxImportModalContext";
import { ErrorToast } from "@/components/layout/ErrorToast";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { DocumentOutlineProvider } from "@/lib/documentOutline";
import { BibLibraryProvider } from "@/lib/bibLibraryContext";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { parentPath, PAPERS_ROOT } from "@/lib/modelTree";
import { resolveModelReloadScope } from "@/lib/modelReloadScope";
import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { gitSyncHasError, isViewSyncPaused } from "@/lib/gitSync";
import { resolveViewSyncWithHarness, type AgentDispatchAction } from "@/lib/agentDispatchClient";
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
import { usePaperPendingReviews } from "@/lib/usePaperPendingReviews";
import { resolveActivePaperSlug } from "@/lib/activePaperSlug";
import { approveDraftAtPath } from "@/lib/draftApproval";
import {
  focusOrToggleEditorPane,
  type EditorPaneId,
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
  const reviewPaperSlug = resolveActivePaperSlug(nav.paperSlug, nav.lastPaperPath);
  const { totalCount: pendingReviewCount, items: pendingReviewItems, reload: reloadPendingReviews } =
    usePaperPendingReviews(reviewPaperSlug, nav.refreshVersion, ws.setError);

  const pendingAiReviewCount = useMemo(
    () => pendingReviewItems.filter((item) => item.aiAssisted).length,
    [pendingReviewItems],
  );

  const reloadActiveModel = useCallback(() => {
    nav.reloadModel(
      resolveModelReloadScope({
        browsePath: nav.browsePath,
        paperPath: nav.paperPath,
        activeFile: nav.activeFile,
      }),
    );
  }, [nav]);

  const handleApproveAllAiChanges = useCallback(async () => {
    const aiItems = pendingReviewItems.filter((item) => item.aiAssisted);
    if (aiItems.length === 0) return;
    try {
      for (const item of aiItems) {
        await approveDraftAtPath(item.path);
      }
      nav.reloadModel(
        resolveModelReloadScope({
          browsePath: nav.browsePath,
          paperPath: nav.paperPath,
          activeFile: nav.activeFile,
        }),
      );
      await reloadPendingReviews();
    } catch (err) {
      ws.setError(err instanceof Error ? err.message : String(err));
    }
  }, [nav, pendingReviewItems, reloadPendingReviews, ws.setError]);

  useEffect(() => {
    errorRef.current = ws.setError;
  }, [errorRef, ws.setError]);
  const readingFocus = useReadingFocus();
  const openDocxImportRef = useRef<(() => void) | undefined>(undefined);

  const handleOpenDocxImport = useCallback(() => {
    nav.setSidebarPanel("paperInfo");
    nav.setSidebarPanelOpen(true);
    openDocxImportRef.current?.();
  }, [nav]);

  useEffect(() => {
    if (readingFocus.active) {
      nav.setSidebarPanelOpen(false);
    }
  }, [nav.setSidebarPanelOpen, readingFocus.active]);
  const { preference: themePreference, setPreference: setThemePreference, cyclePreference } =
    useTheme();
  const [agentPanelFocus, setAgentPanelFocus] = useState<"terminal" | null>(null);
  const [requestedDispatchAction, setRequestedDispatchAction] = useState<{
    action: AgentDispatchAction;
  } | null>(null);
  const [editingSkillPath, setEditingSkillPath] = useState<string | null>(null);

  const {
    terminalHostRef,
    connectionState,
    sendToTerminal,
    sendToTerminalWhenReady,
    refitTerminal,
    reconnectTerminal,
    subscribeOutput,
    getTerminalSessionId,
    getLastInputLine,
  } = useTerminalSession({
    enabled: layout.aiPanelOpen,
    refitTriggers: useMemo(
      () => [
        nav.sidebarPanel,
        nav.currentPath,
        nav.activeFile,
        layout.aiPanelOpen,
        layout.aiPanelWidth,
        layout.aiPanelTerminalOpen,
        layout.sidebarWidth,
      ],
      [
        nav.sidebarPanel,
        nav.currentPath,
        nav.activeFile,
        layout.aiPanelOpen,
        layout.aiPanelWidth,
        layout.aiPanelTerminalOpen,
        layout.sidebarWidth,
      ],
    ),
  });

  const openAgentPanel = useCallback(() => {
    setAgentPanelFocus("terminal");
    layout.setAiPanelOpen(true);
    layout.setAiPanelTerminalOpen(true);
    refitTerminal();
  }, [layout, refitTerminal]);

  const openAgentDispatch = useCallback(
    (intent: Parameters<typeof nav.setDispatchIntent>[0]) => {
      if (!intent) return;
      layout.setAiPanelOpen(true);
      setRequestedDispatchAction({ action: intent.action });
      refitTerminal();
    },
    [layout, refitTerminal],
  );

  const openTerminalPanel = useCallback(() => {
    if (layout.aiPanelOpen && agentPanelFocus === "terminal") {
      layout.setAiPanelOpen(false);
      setAgentPanelFocus(null);
      return;
    }
    setAgentPanelFocus("terminal");
    layout.setAiPanelOpen(true);
    layout.setAiPanelTerminalOpen(true);
    refitTerminal();
  }, [agentPanelFocus, layout, refitTerminal]);

  const [requestedHistoryOpenAt, setRequestedHistoryOpenAt] = useState(0);
  const openHistoryPanel = useCallback(() => {
    layout.setAiPanelOpen(true);
    setRequestedHistoryOpenAt((n) => n + 1);
  }, [layout]);
  const openSkillsPanel = useCallback(() => {
    layout.setAiPanelOpen(true);
    layout.setAiPanelSkillsOpen(true);
  }, [layout]);

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
    nav.focusPaperInfoPanel();
    nav.navigateTo(nav.lastPaperPath ?? PAPERS_ROOT);
  }, [nav, ws]);

  const handleToggleEditorPane = useCallback(
    (pane: EditorPaneId) => {
      const next = focusOrToggleEditorPane(layout.editorVisiblePanes, pane, layout.dualPaneActive);
      layout.setEditorVisiblePanes(next.visible);
      layout.setDualPaneActive(next.active);
    },
    [layout],
  );

  const handleOpenMainBib = useCallback(
    (citeKey?: string) => {
      nav.setSidebarPanel("references");
      nav.openFile("main.bib", citeKey ? { citeKey } : undefined);
    },
    [nav],
  );

  const handleShowUnverifiedReferences = useCallback(() => {
    nav.setSidebarPanel("references");
    nav.openFile("main.bib");
  }, [nav]);

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
        <BibLibraryProvider>
        <DocumentOutlineProvider>
        <main
          className={cn(
            "flex h-screen flex-col overflow-hidden bg-background text-foreground",
            readingFocus.active && "reading-focus-mode",
            ws.explorerMode && "explorer-theme",
          )}
          style={{ "--sidebar-rail-width": "2.25rem" } as React.CSSProperties}
        >
          <AppChromeHeader
            appView={ws.appView}
            browsePath={nav.browsePath}
            onNavigate={nav.navigateTo}
            breadcrumbVariant="papers"
            tree={nav.tree}
            refreshVersion={nav.refreshVersion}
            onOpenFile={nav.openFile}
            paperPath={nav.paperPath}
            searchQuery={nav.searchQuery}
            onSearchChange={nav.setSearchQuery}
            onSearchSelect={nav.handleSearchSelect}
            onRefreshModel={reloadActiveModel}
            onHomeClick={handleHome}
            homeTitle={homeTitle}
            canBack={canFocusBack}
            onBack={handleFocusBack}
            backTitle={focusBackTitle}
            explorerMode={ws.explorerMode}
            aiPanelOpen={layout.aiPanelOpen}
            onToggleAiPanel={() => layout.setAiPanelOpen((open) => !open)}
            onOpenTerminal={openTerminalPanel}
            onOpenHistory={openHistoryPanel}
            onOpenSkills={openSkillsPanel}
          />
          <DocxImportModalProvider
            paperSlug={nav.exportPaperSlug}
            paperPath={nav.paperPath}
            browsePath={nav.browsePath}
            activeFile={nav.activeFile}
            onError={ws.setError}
            onComplete={reloadActiveModel}
            openRef={openDocxImportRef}
          >
          {ws.explorerMode ? null : (
          <AppCommands
            appView={ws.appView}
            editorLayout={layout.editorLayout}
            canGoUp={nav.canGoUp}
            canCreateUnit={nav.canCreateUnit}
            canCreateSection={nav.canCreateFolder && nav.containerKind === "section"}
            canCreateSubsection={nav.canCreateFolder && nav.containerKind === "subsection"}
            showSectionViewBack={nav.showSectionViewBack || nav.showPaperViewBack}
            dualPaneEditorActive={nav.dualPaneEditorActive}
            notesPaneAvailable={nav.notesPaneAvailable}
            pendingAiReviewCount={pendingAiReviewCount}
            selectedBibCiteKey={nav.selectedBibCiteKey}
            onSetAppView={ws.setAppView}
            onSetSidebarPanel={nav.setSidebarPanel}
            onToggleSidebarPanel={nav.toggleSidebarPanel}
            onNavigateUp={handleNavigateUp}
            onBack={nav.backToSectionView}
            onCreateChild={createChild}
            onRefreshModel={reloadActiveModel}
            onToggleBottomPanel={() => layout.setAiPanelOpen((open) => !open)}
            onToggleReadingFocus={readingFocus.toggle}
            onSetEditorLayout={layout.setEditorLayout}
            onGitSync={() => void runGitSync()}
            onCycleTheme={cyclePreference}
            onToggleEditorPane={handleToggleEditorPane}
            onApproveAllAiChanges={() => void handleApproveAllAiChanges()}
            onOpenMainBib={handleOpenMainBib}
            onShowUnverifiedReferences={handleShowUnverifiedReferences}
            onOpenDocxImport={handleOpenDocxImport}
          />
          )}

          {ws.appView === "workspace" && ws.explorerMode ? (
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                readingFocus.active && "reading-focus-shell",
              )}
            >
              <div className="reading-focus-shell__main flex min-h-0 min-w-0 flex-1 flex-col">
            <AiAssistantSplit
              open={layout.aiPanelOpen}
              width={layout.aiPanelWidth}
              onWidthChange={layout.setAiPanelWidth}
              panel={
                <AiAssistantPanelHost
                  onClose={() => layout.setAiPanelOpen(false)}
                  currentPath={ws.explorerActiveTab ?? ""}
                  refreshVersion={nav.refreshVersion}
                  isUnit={false}
                  canFanOut={false}
                  onSendToTerminal={sendToTerminal}
                  onError={ws.setError}
                  onReconnect={reconnectTerminal}
                  onLayoutChange={refitTerminal}
                  terminalHostRef={terminalHostRef}
                  connectionState={connectionState}
                  terminalOpen={layout.aiPanelTerminalOpen}
                  onTerminalOpenChange={layout.setAiPanelTerminalOpen}
                  subscribeOutput={subscribeOutput}
                  getTerminalSessionId={getTerminalSessionId}
                  getLastInputLine={getLastInputLine}
                  skillsOpen={layout.aiPanelSkillsOpen}
                  onSkillsOpenChange={layout.setAiPanelSkillsOpen}
                  onEditSkill={setEditingSkillPath}
                  onOpenFile={(path) =>
                    ws.openExplorerTab(path.startsWith("model/") ? path : `model/${path}`)
                  }
                  requestedHistoryOpenAt={requestedHistoryOpenAt}
                  requestedDispatchAction={requestedDispatchAction}
                />
              }
            >
              {editingSkillPath ? (
                <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-workspace">
                  <SkillEditorWorkspace
                    skillPath={editingSkillPath}
                    onClose={() => setEditingSkillPath(null)}
                    onError={ws.setError}
                  />
                </section>
              ) : (
                <ExplorerWorkspace
                  gitSync={gitSync}
                  gitStatusLabel={gitStatusLabel}
                  connectionState={connectionState}
                  onGitClick={() => void runGitSync()}
                  pinned={nav.sidebarPinned}
                  sidebarWidth={layout.sidebarWidth}
                  onWidthChange={layout.setSidebarWidth}
                />
              )}
            </AiAssistantSplit>
              </div>
            </div>
          ) : ws.appView === "settings" ? (
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
                nav.focusSectionsPanel();
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
                      "--sidebar-width": `${layout.sidebarWidth}px`,
                      "--sidebar-content-width": `${sidebarContentWidth(layout.sidebarWidth)}px`,
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
                    explorerMode={ws.explorerMode}
                    appView={ws.appView}
                    gitSync={gitSync}
                    gitStatusLabel={gitStatusLabel}
                    connectionState={connectionState}
                    themePreference={themePreference}
                    onSelectPanel={nav.setSidebarPanel}
                    onCyclePanelLayout={nav.cycleSidebarPanelLayout}
                    onWidthChange={layout.setSidebarWidth}
                    onExplorerModeChange={ws.setExplorerMode}
                    onGitClick={handleGitBadgeClick}
                    onSetAppView={ws.setAppView}
                    onCycleTheme={cyclePreference}
                    pendingReviewCount={pendingReviewCount}
                    panelContent={
                      <SidebarPanelRegistry
                        panel={nav.sidebarPanel}
                        tree={nav.tree}
                        browsePath={nav.browsePath}
                        activeFile={nav.activeFile}
                        refreshVersion={nav.refreshVersion}
                        graphFetchRoot={nav.graphFetchRoot}
                        graphFocusPath={nav.graphFocusPath}
                        graphScope={nav.graphScope}
                        exportPaperSlug={nav.exportPaperSlug}
                        paperPath={nav.paperPath}
                        onNavigate={nav.navigateTo}
                        onOpenFile={nav.openFile}
                        onGraphScopeChange={nav.setGraphScope}
                        onPaperCreated={(path) => {
                          nav.reloadModel({ path: path.split("/").slice(0, 2).join("/") || path });
                          nav.navigateTo(path);
                        }}
                        onModelChanged={reloadActiveModel}
                        onError={ws.setError}
                      />
                    }
                  />
                  <div className="workspace-main__main flex min-h-0 min-w-0 flex-col">
                  <AiAssistantSplit
                    open={layout.aiPanelOpen}
                    width={layout.aiPanelWidth}
                    onWidthChange={layout.setAiPanelWidth}
                    panel={
                      <AiAssistantPanelHost
                        onClose={() => layout.setAiPanelOpen(false)}
                        currentPath={nav.browsePath}
                        refreshVersion={nav.refreshVersion}
                        isUnit={nav.isUnit}
                        canFanOut={nav.isPaperSection && !nav.isUnit}
                        onSendToTerminal={sendToTerminal}
                        onError={ws.setError}
                        onReconnect={reconnectTerminal}
                        onLayoutChange={refitTerminal}
                        terminalHostRef={terminalHostRef}
                        connectionState={connectionState}
                        terminalOpen={layout.aiPanelTerminalOpen}
                        onTerminalOpenChange={layout.setAiPanelTerminalOpen}
                        subscribeOutput={subscribeOutput}
                        getTerminalSessionId={getTerminalSessionId}
                        getLastInputLine={getLastInputLine}
                        skillsOpen={layout.aiPanelSkillsOpen}
                        onSkillsOpenChange={layout.setAiPanelSkillsOpen}
                        onEditSkill={setEditingSkillPath}
                        onOpenFile={(path) => nav.openFile(path)}
                        onNavigateToUnit={nav.navigateTo}
                        requestedHistoryOpenAt={requestedHistoryOpenAt}
                        requestedDispatchAction={requestedDispatchAction}
                      />
                    }
                  >
                  <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-workspace">
                    {editingSkillPath ? (
                      <SkillEditorWorkspace
                        skillPath={editingSkillPath}
                        onClose={() => setEditingSkillPath(null)}
                        onError={ws.setError}
                      />
                    ) : (
                      <WorkspaceRouter
                        onError={ws.setError}
                        onSendToTerminal={sendToTerminal}
                        onBeforeDispatch={openAgentPanel}
                        onDispatchComplete={reloadActiveModel}
                      />
                    )}
                  </section>
                  </AiAssistantSplit>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          </DocxImportModalProvider>

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
        </BibLibraryProvider>
    </AgentDispatchPanelContext.Provider>
  );
}
