import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ArrowUp,
  FilePlus,
  FolderPlus,
  PanelBottomClose,
  PanelBottomOpen,
  RefreshCw,
  CircleHelp,
  Settings,
  TerminalSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { InfoPage } from "@/components/help/InfoPage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BottomPanel } from "@/components/layout/BottomPanel";
import { ResizableSidebarLayout } from "@/components/layout/ResizableSidebarLayout";
import { WorkspaceNav } from "@/components/nav/WorkspaceNav";
import { WorkspaceModeTabs } from "@/components/layout/WorkspaceModeTabs";
import { WorkspaceRouter } from "@/components/workspace/WorkspaceRouter";
import { PaperExportMenu } from "@/components/paper/PaperExportMenu";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { parentPath } from "@/lib/modelTree";
import { formatGitSyncError, gitSyncHasError, isViewSyncPaused } from "@/lib/gitSync";
import { resolveViewSyncWithHarness } from "@/lib/agentDispatchClient";
import { useGitSyncState } from "@/lib/useGitSyncState";
import { useTerminalSession } from "@/lib/useTerminalSession";
import { useTheme } from "@/lib/useTheme";
import { useReadingFocus } from "@/lib/readingFocus";
import { ReadingFocusNavBar } from "@/components/editor/ReadingFocusNavBar";
import {
  ReadingFocusGraphProvider,
  type ReadingFocusGraphConfig,
} from "@/lib/readingFocusGraph";
import { AgentDispatchPanelContext } from "@/lib/agentDispatchPanel";
import { AppCommands } from "@/components/commands/AppCommands";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace/WorkspaceProvider";

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

  useEffect(() => {
    errorRef.current = ws.setError;
  }, [errorRef, ws.setError]);
  const readingFocus = useReadingFocus();
  const { preference: themePreference, setPreference: setThemePreference, cyclePreference } =
    useTheme();

  const {
    terminalHostRef,
    connectionState,
    sendToTerminal,
    refitTerminal,
    reconnectTerminal,
  } = useTerminalSession({
    enabled: ws.agentPanelOpen,
    refitTriggers: useMemo(
      () => [
        ws.sidebarTab,
        ws.currentPath,
        ws.activeFile,
        ws.agentPanelOpen,
        ws.sidebarWidth,
        ws.bottomPanelHeight,
      ],
      [
        ws.sidebarTab,
        ws.currentPath,
        ws.activeFile,
        ws.agentPanelOpen,
        ws.sidebarWidth,
        ws.bottomPanelHeight,
      ],
    ),
  });

  const openAgentPanel = useCallback(() => {
    ws.setAgentPanelOpen(true);
    refitTerminal();
  }, [refitTerminal, ws]);

  const openAgentDispatch = useCallback(
    (intent: Parameters<typeof ws.setDispatchIntent>[0]) => {
      ws.setAgentPanelOpen(true);
      ws.setDispatchIntent(intent);
      refitTerminal();
    },
    [refitTerminal, ws],
  );

  const agentDispatchPanelValue = useMemo(
    () => ({ openDispatch: openAgentDispatch }),
    [openAgentDispatch],
  );

  const resolveViewSyncHarness = useCallback(async () => {
    try {
      openAgentPanel();
      await resolveViewSyncWithHarness({ onSendToTerminal: sendToTerminal });
    } catch (err) {
      ws.setError(err instanceof Error ? err.message : String(err));
    }
  }, [openAgentPanel, sendToTerminal, ws]);

  const viewSyncPaused = isViewSyncPaused(gitSync);
  const showFocusGraph =
    readingFocus.active && Boolean(ws.graphFetchRoot) && ws.appView === "workspace";

  const focusGraphConfig = useMemo<ReadingFocusGraphConfig | null>(
    () =>
      showFocusGraph
        ? {
            fetchRoot: ws.graphFetchRoot!,
            focusPath: ws.graphFocusPath,
            graphScope: ws.graphScope,
            refreshVersion: ws.refreshVersion,
            onGraphScopeChange: ws.setGraphScope,
            onSelectNode: ws.navigateTo,
          }
        : null,
    [showFocusGraph, ws],
  );

  const handleNavigateUp = useCallback(() => {
    ws.navigateTo(parentPath(ws.browsePath));
  }, [ws]);

  const canFocusBack = ws.showPaperViewBack || ws.showSectionViewBack || ws.canGoUp;
  const handleFocusBack = useCallback(() => {
    if (ws.showPaperViewBack || ws.showSectionViewBack) {
      ws.backToSectionView();
      return;
    }
    if (ws.canGoUp) {
      ws.navigateTo(parentPath(ws.browsePath));
    }
  }, [ws]);

  const focusBackTitle = ws.showPaperViewBack
    ? "Back to paper view"
    : ws.showSectionViewBack
      ? "Back to section view"
      : "Back";

  const createChild = (kind: typeof ws.containerKind) => {
    ws.setCreatePrompt({ kind });
  };

  return (
    <AgentDispatchPanelContext.Provider value={agentDispatchPanelValue}>
      <ReadingFocusGraphProvider config={focusGraphConfig}>
        <main
          className={cn(
            "flex h-screen flex-col overflow-hidden bg-background text-foreground",
            readingFocus.active && "reading-focus-mode",
          )}
        >
          <ReadingFocusNavBar
            path={ws.browsePath}
            onNavigate={ws.navigateTo}
            breadcrumbVariant={ws.sidebarTab === "papers" ? "papers" : "default"}
            canBack={canFocusBack}
            onBack={handleFocusBack}
            backTitle={focusBackTitle}
          />
          <AppCommands
            appView={ws.appView}
            sidebarTab={ws.sidebarTab}
            editorLayout={ws.editorLayout}
            canGoUp={ws.canGoUp}
            canCreateUnit={ws.canCreateUnit}
            canCreateSection={ws.canCreateFolder && ws.containerKind === "section"}
            canCreateSubsection={ws.canCreateFolder && ws.containerKind === "subsection"}
            showSectionViewBack={ws.showSectionViewBack || ws.showPaperViewBack}
            onSetAppView={ws.setAppView}
            onSetSidebarTab={ws.handleSidebarTabChange}
            onNavigateUp={handleNavigateUp}
            onBack={ws.backToSectionView}
            onCreateChild={createChild}
            onRefreshModel={ws.reloadModel}
            onToggleBottomPanel={() => ws.setAgentPanelOpen((open) => !open)}
            onToggleReadingFocus={readingFocus.toggle}
            onSetEditorLayout={ws.setEditorLayout}
            onGitSync={() => void runGitSync()}
            onCycleTheme={cyclePreference}
          />
          <header className="app-chrome-header relative z-20 flex h-11 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-card px-2 shadow-sm sm:gap-3 sm:px-4">
            <div className="app-chrome-header__lead flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden sm:gap-3">
              <div className="flex shrink-0 items-center gap-1.5">
                <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="hidden text-sm font-semibold tracking-tight sm:inline">TreeWriter</span>
              </div>
              <div className="hidden h-4 w-px shrink-0 bg-border md:block" />
              {ws.appView === "workspace" ? (
                <>
                  <WorkspaceModeTabs activeTab={ws.sidebarTab} onTabChange={ws.handleSidebarTabChange} />
                  <div className="hidden h-4 w-px shrink-0 bg-border lg:block" />
                  <div className="hidden min-w-0 lg:block">
                    <Breadcrumbs
                      path={ws.browsePath}
                      onNavigate={ws.navigateTo}
                      variant={ws.sidebarTab === "papers" ? "papers" : "default"}
                    />
                  </div>
                </>
              ) : ws.appView === "settings" ? (
                <span className="truncate text-sm text-muted-foreground">Settings</span>
              ) : (
                <span className="truncate text-sm text-muted-foreground">Guide</span>
              )}
            </div>

            <div className="app-chrome-header__actions flex shrink-0 items-center gap-1 sm:gap-2">
              {ws.appView === "workspace" ? (
                <>
                  <button
                    type="button"
                    className={cn(
                      gitSync?.conflictDetected
                        ? "ui-badge-destructive"
                        : gitSync?.lastError
                          ? "ui-badge-warning"
                          : gitSync?.running
                            ? "ui-badge-warning"
                            : gitSync?.enabled
                              ? "ui-badge-success"
                              : "ui-badge-neutral",
                      "max-w-[3.25rem] cursor-pointer truncate transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-none",
                    )}
                    title={
                      gitSync && gitSyncHasError(gitSync)
                        ? formatGitSyncError(gitSync)
                        : gitSync?.enabled
                          ? gitSync.autoSync === false
                            ? "Git sync — auto sync off (click to sync now)"
                            : `Git sync (auto every ${Math.round((gitSync.intervalMs ?? 120_000) / 1000)}s) — click to sync now`
                          : "Git sync disabled"
                    }
                    disabled={!gitSync?.enabled || gitSync?.running}
                    onClick={handleGitBadgeClick}
                  >
                    <span className="sm:hidden">{gitStatusLabel}</span>
                    <span className="hidden sm:inline">git {gitStatusLabel}</span>
                  </button>
                  <span className="ui-badge-neutral hidden min-[640px]:inline-flex">
                    terminal {connectionState}
                  </span>
                  <Button
                    type="button"
                    variant={ws.agentPanelOpen ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    title={ws.agentPanelOpen ? "Hide bottom panel" : "Show terminal & AI dispatch"}
                    aria-label={ws.agentPanelOpen ? "Hide bottom panel" : "Show bottom panel"}
                    aria-pressed={ws.agentPanelOpen}
                    onClick={() => ws.setAgentPanelOpen((open) => !open)}
                  >
                    {ws.agentPanelOpen ? (
                      <PanelBottomClose className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <PanelBottomOpen className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 md:inline-flex"
                    title="Refresh model"
                    aria-label="Refresh model"
                    onClick={() => ws.reloadModel()}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <div className="hidden lg:block">
                    <PaperExportMenu
                      paperSlug={ws.exportPaperSlug}
                      onError={ws.setError}
                      onComplete={() => ws.reloadModel()}
                    />
                  </div>
                </>
              ) : null}
              <ThemeToggle preference={themePreference} onCycle={cyclePreference} />
              <Button
                type="button"
                variant={ws.appView === "info" ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                title="Guide & shortcuts"
                aria-label="Guide and shortcuts"
                aria-pressed={ws.appView === "info"}
                onClick={() => ws.setAppView((view) => (view === "info" ? "workspace" : "info"))}
              >
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant={ws.appView === "settings" ? "default" : "outline"}
                size="icon"
                title="Settings"
                aria-label="Settings"
                aria-pressed={ws.appView === "settings"}
                onClick={() => ws.setAppView((view) => (view === "settings" ? "workspace" : "settings"))}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </header>

          {ws.appView === "settings" ? (
            <SettingsPage
              onBack={() => ws.setAppView("workspace")}
              onError={ws.setError}
              onGitSyncChange={handleGitSyncSettingsChange}
              viewSyncPaused={viewSyncPaused}
              onResolveViewSync={() => void resolveViewSyncHarness()}
              themePreference={themePreference}
              onThemePreferenceChange={setThemePreference}
            />
          ) : ws.appView === "info" ? (
            <InfoPage onBack={() => ws.setAppView("workspace")} />
          ) : (
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                readingFocus.active && "reading-focus-shell",
              )}
            >
              <div className="workspace-shell flex min-h-0 min-w-0 flex-1 flex-col">
                <ResizableSidebarLayout
                  width={ws.sidebarWidth}
                  onWidthChange={ws.setSidebarWidth}
                  sidebar={
                    <WorkspaceNav
                      tree={ws.tree}
                      currentPath={ws.browsePath}
                      activeFile={ws.activeFile}
                      activeTab={ws.sidebarTab}
                      searchQuery={ws.searchQuery}
                      refreshVersion={ws.refreshVersion}
                      onSearchChange={ws.setSearchQuery}
                      onNavigate={ws.navigateTo}
                      onOpenFile={ws.openFile}
                      onSearchSelect={ws.handleSearchSelect}
                      onPaperCreated={(path) => {
                        ws.reloadModel();
                        ws.navigateTo(path);
                        ws.handleSidebarTabChange("papers");
                      }}
                      onModelChanged={ws.reloadModel}
                      onError={ws.setError}
                      graphFetchRoot={ws.graphFetchRoot ?? ""}
                      graphFocusPath={ws.graphFocusPath}
                      graphScope={ws.graphScope}
                      onGraphScopeChange={ws.setGraphScope}
                      onGraphSelectNode={(id) => {
                        if (id.startsWith("missing:")) return;
                        ws.navigateTo(id);
                      }}
                    />
                  }
                >
                  <section className="relative flex min-h-0 flex-1 flex-col bg-workspace">
                    <div className="flex min-h-0 flex-1 flex-col">
                      <WorkspaceRouter
                        onError={ws.setError}
                        onSendToTerminal={sendToTerminal}
                        onBeforeDispatch={openAgentPanel}
                        onDispatchComplete={ws.reloadModel}
                      />
                    </div>

                    <footer className="workspace-status-footer flex h-9 shrink-0 items-center gap-1.5 border-t border-border bg-card px-2 text-[11px] text-muted-foreground sm:gap-2 sm:px-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        <div className="min-w-0 shrink sm:hidden">
                          <Breadcrumbs
                            path={ws.browsePath}
                            onNavigate={ws.navigateTo}
                            compact
                            variant={ws.sidebarTab === "papers" ? "papers" : "default"}
                          />
                        </div>
                        <span className="hidden truncate sm:inline">
                          {ws.commentSummary && ws.commentSummary.unresolved > 0
                            ? `${ws.commentSummary.unresolved} unresolved comment${ws.commentSummary.unresolved === 1 ? "" : "s"}`
                            : `${ws.files.length} files · autosave on`}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {ws.canCreateFolder ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={`New ${ws.containerKind}`}
                            onClick={() => createChild(ws.containerKind)}
                          >
                            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ) : null}
                        {ws.canCreateUnit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="New unit"
                            onClick={() => createChild("unit")}
                          >
                            <FilePlus className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Up one level"
                          disabled={!ws.canGoUp}
                          onClick={() => ws.navigateTo(parentPath(ws.browsePath))}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <span
                        className="hidden max-w-xs truncate shrink-0 sm:inline"
                        title={gitSync?.lastError ?? undefined}
                      >
                        {gitSync && gitSyncHasError(gitSync)
                          ? gitSync.lastError ?? "Git sync conflict — click badge for details"
                          : gitSync?.lastSuccessAt
                            ? `Synced ${new Date(gitSync.lastSuccessAt).toLocaleTimeString()}`
                            : "Awaiting sync"}
                      </span>
                      {viewSyncPaused ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                          onClick={() => void resolveViewSyncHarness()}
                        >
                          Resolve with harness
                        </Button>
                      ) : null}
                    </footer>
                  </section>
                </ResizableSidebarLayout>

                <BottomPanel
                  open={ws.agentPanelOpen}
                  onOpenChange={ws.setAgentPanelOpen}
                  currentPath={ws.browsePath}
                  refreshVersion={ws.refreshVersion}
                  height={ws.bottomPanelHeight}
                  onHeightChange={ws.setBottomPanelHeight}
                  isUnit={ws.isUnit}
                  canFanOut={ws.isPaperSection && !ws.isUnit}
                  dispatchIntent={ws.dispatchIntent}
                  initialDispatchTab={ws.dispatchIntent ? "run" : undefined}
                  onDispatchIntentConsumed={ws.clearDispatchIntent}
                  onSendToTerminal={sendToTerminal}
                  onError={ws.setError}
                  onReconnect={reconnectTerminal}
                  onLayoutChange={refitTerminal}
                  terminalHostRef={terminalHostRef}
                />
              </div>
            </div>
          )}

          <NamePromptDialog
            open={ws.createPrompt !== null}
            title={ws.createPrompt ? `New ${ws.createPrompt.kind}` : "New node"}
            label="Folder-safe name (lowercase, hyphens ok)"
            confirmLabel="Create"
            onConfirm={(name) => void ws.submitCreateChild(name)}
            onCancel={() => ws.setCreatePrompt(null)}
          />

          {ws.error ? (
            <div className="fixed bottom-3 right-3 flex max-w-lg items-start gap-2 rounded-lg border border-destructive/40 bg-background px-3 py-2 text-xs text-destructive shadow-lg">
              <span className="min-w-0 flex-1 whitespace-pre-wrap">{ws.error}</span>
              <div className="flex shrink-0 flex-col gap-1">
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
                <button type="button" className="underline" onClick={() => ws.setError(null)}>
                  dismiss
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </ReadingFocusGraphProvider>
    </AgentDispatchPanelContext.Provider>
  );
}

