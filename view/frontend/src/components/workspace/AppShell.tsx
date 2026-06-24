import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  FilePlus,
  FolderPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { InfoPage } from "@/components/help/InfoPage";
import { AppChromeHeader } from "@/components/layout/AppChromeHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BottomPanel, type DispatchPaneTab } from "@/components/layout/BottomPanel";
import { WorkspaceSidebarShell } from "@/components/layout/WorkspaceSidebarShell";
import { WorkspaceNav } from "@/components/nav/WorkspaceNav";
import { DocumentOutlinePanel } from "@/components/nav/DocumentOutlinePanel";
import { ReadingFocusOutlineRail } from "@/components/editor/ReadingFocusOutlineRail";
import { PaperExportPanel } from "@/components/paper/PaperExportPanel";
import { GraphPanel } from "@/components/graph/GraphPanel";
import { WorkspaceRouter } from "@/components/workspace/WorkspaceRouter";
import { DocumentOutlineProvider } from "@/lib/documentOutline";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { parentPath } from "@/lib/modelTree";
import { gitSyncHasError, isViewSyncPaused } from "@/lib/gitSync";
import { resolveViewSyncWithHarness } from "@/lib/agentDispatchClient";
import { useGitSyncState } from "@/lib/useGitSyncState";
import { useTerminalSession } from "@/lib/useTerminalSession";
import { useTheme } from "@/lib/useTheme";
import { useReadingFocus } from "@/lib/readingFocus";
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
    setAgentPanelFocus("terminal");
    ws.setAgentPanelOpen(true);
    refitTerminal();
  }, [refitTerminal, ws]);

  const openAgentDispatch = useCallback(
    (intent: Parameters<typeof ws.setDispatchIntent>[0]) => {
      setAgentPanelFocus("dispatch");
      setRequestedDispatchTab("run");
      ws.setAgentPanelOpen(true);
      ws.setDispatchIntent(intent);
      refitTerminal();
    },
    [refitTerminal, ws],
  );

  const openTerminalPanel = useCallback(() => {
    if (ws.agentPanelOpen && agentPanelFocus === "terminal") {
      ws.setAgentPanelOpen(false);
      setAgentPanelFocus(null);
      return;
    }
    setAgentPanelFocus("terminal");
    setRequestedDispatchTab(undefined);
    ws.setAgentPanelOpen(true);
    refitTerminal();
  }, [agentPanelFocus, refitTerminal, ws]);

  const openDispatchPanel = useCallback(() => {
    if (ws.agentPanelOpen && agentPanelFocus === "dispatch") {
      ws.setAgentPanelOpen(false);
      setAgentPanelFocus(null);
      return;
    }
    setAgentPanelFocus("dispatch");
    setRequestedDispatchTab("run");
    ws.setAgentPanelOpen(true);
    refitTerminal();
  }, [agentPanelFocus, refitTerminal, ws]);

  const handleAgentPanelOpenChange = useCallback(
    (open: boolean) => {
      ws.setAgentPanelOpen(open);
      if (!open) setAgentPanelFocus(null);
    },
    [ws],
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
        <DocumentOutlineProvider>
        <main
          className={cn(
            "flex h-screen flex-col overflow-hidden bg-background text-foreground",
            readingFocus.active && "reading-focus-mode",
          )}
        >
          <AppChromeHeader
            appView={ws.appView}
            browsePath={ws.browsePath}
            onNavigate={ws.navigateTo}
            breadcrumbVariant={ws.sidebarTab === "papers" ? "papers" : "default"}
            tree={ws.tree}
            refreshVersion={ws.refreshVersion}
            onOpenFile={ws.openFile}
            paperPath={ws.paperPath}
            searchQuery={ws.searchQuery}
            onSearchChange={ws.setSearchQuery}
            onSearchSelect={ws.handleSearchSelect}
            onRefreshModel={() => ws.reloadModel()}
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
            onSetSidebarPanel={ws.setSidebarPanel}
            onToggleSidebarPanel={ws.toggleSidebarPanel}
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
              {readingFocus.active ? <ReadingFocusOutlineRail /> : null}
              <div className="reading-focus-shell__main flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="workspace-shell flex min-h-0 min-w-0 flex-1 flex-col">
                <div
                  className={cn(
                    "workspace-main min-h-0 flex-1",
                    !ws.sidebarPanelOpen && "workspace-main--sidebar-collapsed",
                  )}
                  style={
                    {
                      "--sidebar-rail-width": "36px",
                      "--sidebar-width": `${ws.sidebarPanelOpen ? ws.sidebarWidth : 0}px`,
                    } as React.CSSProperties
                  }
                >
                  <WorkspaceSidebarShell
                    activePanel={ws.sidebarPanel}
                    panelOpen={ws.sidebarPanelOpen}
                    graphAvailable={Boolean(ws.graphFetchRoot)}
                    sidebarWidth={ws.sidebarWidth}
                    agentPanelOpen={ws.agentPanelOpen}
                    agentPanelFocus={agentPanelFocus}
                    appView={ws.appView}
                    gitSync={gitSync}
                    gitStatusLabel={gitStatusLabel}
                    connectionState={connectionState}
                    themePreference={themePreference}
                    onSelectPanel={ws.setSidebarPanel}
                    onTogglePanel={ws.toggleSidebarPanel}
                    onWidthChange={ws.setSidebarWidth}
                    onOpenTerminalPanel={openTerminalPanel}
                    onOpenDispatchPanel={openDispatchPanel}
                    onCloseAgentPanel={() => handleAgentPanelOpenChange(false)}
                    onGitClick={handleGitBadgeClick}
                    onSetAppView={ws.setAppView}
                    onCycleTheme={cyclePreference}
                    panelContent={
                      ws.sidebarPanel === "outline" ? (
                        <DocumentOutlinePanel className="h-full" />
                      ) : ws.sidebarPanel === "graph" ? (
                        <div className="graph-tab-host flex h-full min-h-[200px] flex-col overflow-hidden">
                          <GraphPanel
                            embedded
                            active
                            fetchRoot={ws.graphFetchRoot ?? ""}
                            focusPath={ws.graphFocusPath}
                            graphScope={ws.graphScope}
                            refreshVersion={ws.refreshVersion}
                            onGraphScopeChange={ws.setGraphScope}
                            onSelectNode={(id) => {
                              if (id.startsWith("missing:")) return;
                              ws.navigateTo(id);
                            }}
                          />
                        </div>
                      ) : ws.sidebarPanel === "export" ? (
                        <PaperExportPanel
                          className="h-full"
                          paperSlug={ws.exportPaperSlug}
                          onError={ws.setError}
                          onComplete={() => ws.reloadModel()}
                        />
                      ) : (
                        <WorkspaceNav
                          tree={ws.tree}
                          currentPath={ws.browsePath}
                          activeFile={ws.activeFile}
                          activeTab={ws.sidebarPanel === "papers" ? "papers" : "explorer"}
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
                      )
                    }
                  />
                  <div className="workspace-main__main min-h-0 min-w-0">
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
                  </div>
                </div>

                <BottomPanel
                  open={ws.agentPanelOpen}
                  onOpenChange={handleAgentPanelOpenChange}
                  currentPath={ws.browsePath}
                  refreshVersion={ws.refreshVersion}
                  height={ws.bottomPanelHeight}
                  onHeightChange={ws.setBottomPanelHeight}
                  isUnit={ws.isUnit}
                  canFanOut={ws.isPaperSection && !ws.isUnit}
                  dispatchIntent={ws.dispatchIntent}
                  initialDispatchTab={
                    requestedDispatchTab ?? (ws.dispatchIntent ? "run" : undefined)
                  }
                  onDispatchIntentConsumed={ws.clearDispatchIntent}
                  onSendToTerminal={sendToTerminal}
                  onError={ws.setError}
                  onReconnect={reconnectTerminal}
                  onLayoutChange={refitTerminal}
                  terminalHostRef={terminalHostRef}
                />
              </div>
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
        </DocumentOutlineProvider>
      </ReadingFocusGraphProvider>
    </AgentDispatchPanelContext.Provider>
  );
}

