import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  FilePlus,
  FolderPlus,
  PanelBottomClose,
  PanelBottomOpen,
  RefreshCw,
  Settings,
  TerminalSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BottomPanel } from "@/components/layout/BottomPanel";
import { ResizableSidebarLayout } from "@/components/layout/ResizableSidebarLayout";
import { WorkspaceNav, type WorkspaceNavTab } from "@/components/nav/WorkspaceNav";
import { WorkspaceModeTabs } from "@/components/layout/WorkspaceModeTabs";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { PaperWorkspace } from "@/components/editor/PaperWorkspace";
import { SectionWorkspace } from "@/components/editor/SectionWorkspace";
import { TableWorkspace } from "@/components/editor/TableWorkspace";
import type { EditorLayout } from "@/components/editor/MarkdownEditor";
import { FolderBrowse } from "@/components/nav/FolderBrowse";
import {
  findNode,
  flattenFiles,
  isFigureFolder,
  isEquationFolder,
  isSectionContainer,
  isTableFolder,
  isUnderPapers,
  isUnitFolder,
  outlinePathFor,
  parentPath,
  PAPERS_ROOT,
} from "@/lib/modelTree";
import { createNode, fetchCommentSummary, type NodeKind } from "@/modelApi";
import { PaperExportMenu } from "@/components/paper/PaperExportMenu";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  saveWorkspacePreferences,
} from "@/lib/workspacePreferences";
import type { GraphScope } from "@/lib/graphLocal";
import { resolveGraphFetchRoot } from "@/lib/graphLocal";
import { formatGitSyncError, gitSyncHasError, isViewSyncPaused } from "@/lib/gitSync";
import { resolveViewSyncWithHarness } from "@/lib/agentDispatchClient";
import { useGitSyncState } from "@/lib/useGitSyncState";
import { useModelTree } from "@/lib/useModelTree";
import { useTerminalSession } from "@/lib/useTerminalSession";
import { useWorkspaceNavigation } from "@/lib/useWorkspaceNavigation";

type AppView = "workspace" | "settings";

export default function App() {
  const savedPrefs = useMemo(() => mergeWorkspaceDefaults(loadWorkspacePreferences()), []);

  const [currentPath, setCurrentPath] = useState(savedPrefs.currentPath);
  const [activeFile, setActiveFile] = useState<string | null>(savedPrefs.activeFile);
  const [editorLayout, setEditorLayout] = useState<EditorLayout>(savedPrefs.editorLayout);
  const [sidebarTab, setSidebarTab] = useState<WorkspaceNavTab>(savedPrefs.sidebarTab);
  const [searchQuery, setSearchQuery] = useState(savedPrefs.searchQuery);
  const [appView, setAppView] = useState<AppView>("workspace");
  const [error, setError] = useState<string | null>(null);
  const [agentPanelOpen, setAgentPanelOpen] = useState(savedPrefs.agentPanelOpen);
  const [dualPaneSplit, setDualPaneSplit] = useState(savedPrefs.dualPaneSplit);
  const [sidebarWidth, setSidebarWidth] = useState(savedPrefs.sidebarWidth);
  const [graphScope, setGraphScope] = useState<GraphScope>(savedPrefs.graphScope);
  const [createPrompt, setCreatePrompt] = useState<{ kind: NodeKind } | null>(null);
  const [commentSummary, setCommentSummary] = useState<{ unresolved: number; total: number } | null>(
    null,
  );

  const {
    gitSync,
    loadGitSyncStatus,
    runGitSync,
    handleGitSyncSettingsChange,
    handleGitBadgeClick,
    gitStatusLabel,
  } = useGitSyncState({ onError: setError });

  const onModelEventsRefresh = useCallback(() => {
    loadGitSyncStatus().catch(() => {});
  }, [loadGitSyncStatus]);

  const { tree, treeLoaded, refreshVersion, reloadModel } = useModelTree({
    onError: setError,
    onEventsRefresh: onModelEventsRefresh,
  });

  const {
    openFile,
    navigateTo,
    handleMarkdownNavigate,
    backToSectionView,
    handleSidebarTabChange,
    handleSearchSelect,
  } = useWorkspaceNavigation({
    tree,
    sidebarTab,
    setCurrentPath,
    setActiveFile,
    setEditorLayout,
    setSidebarTab,
  });

  const {
    terminalElementRef,
    connectionState,
    sendToTerminal,
    refitTerminal,
    reconnectTerminal,
  } = useTerminalSession({
    refitTriggers: [sidebarTab, currentPath, activeFile, agentPanelOpen, sidebarWidth],
  });

  const files = useMemo(() => flattenFiles(tree), [tree]);
  const browsePath =
    sidebarTab === "papers"
      ? isUnderPapers(currentPath)
        ? currentPath
        : PAPERS_ROOT
      : currentPath;
  const paperSlug = useMemo(() => {
    const match = browsePath.match(/^papers\/([^/]+)/);
    return match?.[1] ?? null;
  }, [browsePath]);
  const paperPath = useMemo(
    () => (paperSlug ? `papers/${paperSlug}` : null),
    [paperSlug],
  );
  const currentNode = browsePath ? findNode(tree, browsePath) : null;
  const isFigure = isFigureFolder(currentNode);
  const isTable = isTableFolder(currentNode);
  const isEquation = isEquationFolder(currentNode);
  const isUnit = isUnitFolder(currentNode);
  const isPaperRoot = paperPath !== null && browsePath === paperPath;
  const isPaperSection = isSectionContainer(currentNode) && isUnderPapers(browsePath);
  const paperWorkspacePath = isPaperRoot && !activeFile ? paperPath : null;
  const tablePath = isTable ? browsePath : null;
  const tableTitle = useMemo(() => {
    if (!tablePath) return "Table";
    const base = tablePath.split("/").pop() ?? "table";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }, [tablePath]);
  const unitPath = isUnit || isFigure || isEquation ? browsePath : null;
  const sectionPath = isPaperSection && !activeFile && !isPaperRoot ? browsePath : null;
  const graphFocusPath = activeFile ? parentPath(activeFile) : currentPath || browsePath;
  const graphFetchRoot = resolveGraphFetchRoot(graphFocusPath);
  const exportPaperSlug = paperSlug;

  useEffect(() => {
    saveWorkspacePreferences({
      sidebarTab,
      currentPath,
      activeFile,
      editorLayout,
      agentPanelOpen,
      searchQuery,
      graphRoot: graphFocusPath,
      graphScope,
      dualPaneSplit,
      sidebarWidth,
    });
  }, [
    activeFile,
    agentPanelOpen,
    currentPath,
    dualPaneSplit,
    editorLayout,
    graphFocusPath,
    graphScope,
    searchQuery,
    sidebarTab,
    sidebarWidth,
  ]);

  const showSectionViewBack = Boolean(activeFile && isPaperSection && !isUnit && !isPaperRoot);
  const showPaperViewBack = Boolean(activeFile && isPaperRoot);

  useEffect(() => {
    if (!treeLoaded) return;
    if (browsePath && (!currentNode || currentNode.type !== "directory")) {
      if (sidebarTab === "papers") {
        setCurrentPath(PAPERS_ROOT);
      } else {
        setCurrentPath("");
      }
      setActiveFile(null);
    }
  }, [browsePath, currentNode, sidebarTab, treeLoaded]);

  useEffect(() => {
    if (!treeLoaded) return;
    if (sidebarTab === "papers" && !isUnderPapers(currentPath)) {
      setCurrentPath(PAPERS_ROOT);
      setActiveFile(null);
    }
  }, [currentPath, sidebarTab, treeLoaded]);

  useEffect(() => {
    if (!treeLoaded || !isUnit) return;
    setActiveFile((current) => {
      if (current?.startsWith(`${browsePath}/`)) return current;
      return outlinePathFor(browsePath);
    });
    setEditorLayout("split");
  }, [browsePath, isUnit, treeLoaded]);

  useEffect(() => {
    if (!paperSlug) {
      setCommentSummary(null);
      return;
    }
    const load = () => fetchCommentSummary(paperSlug).then(setCommentSummary).catch(() => {});
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, [paperSlug, refreshVersion]);

  const openAgentPanel = useCallback(() => {
    setAgentPanelOpen(true);
    refitTerminal();
  }, [refitTerminal]);

  const resolveViewSyncHarness = useCallback(async () => {
    try {
      openAgentPanel();
      await resolveViewSyncWithHarness({ onSendToTerminal: sendToTerminal });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [openAgentPanel, sendToTerminal]);

  const containerKind: NodeKind =
    paperPath && browsePath === paperPath
      ? "section"
      : browsePath === "" || /(^|\/)sections$/.test(browsePath)
        ? "section"
        : "subsection";
  const isLeafAssetOrUnit = isUnit || isFigure || isTable || isEquation;
  const underPaper = paperPath !== null && browsePath.startsWith(paperPath);
  const canCreateFolder =
    sidebarTab === "papers"
      ? underPaper && !isLeafAssetOrUnit
      : browsePath !== PAPERS_ROOT;
  const canCreateUnit =
    sidebarTab === "papers"
      ? underPaper && browsePath !== paperPath && !isLeafAssetOrUnit
      : Boolean(currentNode && isSectionContainer(currentNode));
  const canGoUp =
    sidebarTab === "papers" ? browsePath !== PAPERS_ROOT && browsePath !== "" : Boolean(browsePath);

  const createChild = (kind: NodeKind) => {
    setCreatePrompt({ kind });
  };

  const submitCreateChild = async (name: string) => {
    if (!createPrompt) return;
    const { kind } = createPrompt;
    setCreatePrompt(null);
    try {
      const created = await createNode(browsePath, name, kind);
      reloadModel();
      if (kind !== "unit") navigateTo(created.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const viewSyncPaused = isViewSyncPaused(gitSync);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-20 flex h-11 shrink-0 items-center justify-between gap-4 overflow-visible border-b border-border bg-card px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">TreeWriter</span>
          </div>
          <div className="hidden h-4 w-px bg-border sm:block" />
          {appView === "workspace" ? (
            <>
              <WorkspaceModeTabs activeTab={sidebarTab} onTabChange={handleSidebarTabChange} />
              <div className="hidden h-4 w-px bg-border sm:block" />
              <div className="hidden min-w-0 sm:block">
                <Breadcrumbs
                  path={browsePath}
                  onNavigate={navigateTo}
                  variant={sidebarTab === "papers" ? "papers" : "default"}
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Settings</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {appView === "workspace" ? (
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
              "cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
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
            git {gitStatusLabel}
          </button>
          <span className="ui-badge-neutral">terminal {connectionState}</span>
          <Button
            type="button"
            variant={agentPanelOpen ? "default" : "outline"}
            size="icon"
            title={agentPanelOpen ? "Hide bottom panel" : "Show terminal & AI dispatch"}
            aria-label={agentPanelOpen ? "Hide bottom panel" : "Show bottom panel"}
            aria-pressed={agentPanelOpen}
            onClick={() => setAgentPanelOpen((open) => !open)}
          >
            {agentPanelOpen ? (
              <PanelBottomClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelBottomOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button type="button" variant="outline" size="icon" title="Refresh model" onClick={() => reloadModel()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <PaperExportMenu
            paperSlug={exportPaperSlug}
            onError={setError}
            onComplete={() => reloadModel()}
          />
            </>
          ) : null}
          <Button
            type="button"
            variant={appView === "settings" ? "default" : "outline"}
            size="icon"
            title="Settings"
            aria-label="Settings"
            aria-pressed={appView === "settings"}
            onClick={() => setAppView((view) => (view === "settings" ? "workspace" : "settings"))}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {appView === "settings" ? (
        <SettingsPage
          onBack={() => setAppView("workspace")}
          onError={setError}
          onGitSyncChange={handleGitSyncSettingsChange}
          viewSyncPaused={viewSyncPaused}
          onResolveViewSync={() => void resolveViewSyncHarness()}
        />
      ) : (
      <div className="workspace-shell flex min-h-0 min-w-0 flex-1 flex-col">
        <ResizableSidebarLayout
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          sidebar={
            <WorkspaceNav
              tree={tree}
              currentPath={browsePath}
              activeFile={activeFile}
              activeTab={sidebarTab}
              searchQuery={searchQuery}
              refreshVersion={refreshVersion}
              onSearchChange={setSearchQuery}
              onNavigate={navigateTo}
              onOpenFile={openFile}
              onSearchSelect={handleSearchSelect}
              onPaperCreated={(path) => {
                reloadModel();
                navigateTo(path);
                setSidebarTab("papers");
              }}
              onModelChanged={reloadModel}
              onError={setError}
              graphFetchRoot={graphFetchRoot}
              graphFocusPath={graphFocusPath}
              graphScope={graphScope}
              onGraphScopeChange={setGraphScope}
              onGraphSelectNode={(id) => {
                if (id.startsWith("missing:")) return;
                navigateTo(id);
              }}
            />
          }
        >
        <section className="relative flex min-h-0 flex-1 flex-col bg-workspace">
          <div className="flex min-h-0 flex-1 flex-col">
            {paperWorkspacePath ? (
              <PaperWorkspace
                paperPath={paperWorkspacePath}
                refreshVersion={refreshVersion}
                onNavigate={navigateTo}
                onOpenFile={openFile}
                onError={setError}
                dualPaneSplit={dualPaneSplit}
                onDualPaneSplitChange={setDualPaneSplit}
                onDispatchComplete={reloadModel}
                onSendToTerminal={sendToTerminal}
                onBeforeDispatch={openAgentPanel}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSelect={handleSearchSelect}
              />
            ) : tablePath ? (
              <TableWorkspace
                tablePath={tablePath}
                tableTitle={tableTitle}
                refreshVersion={refreshVersion}
                onError={setError}
                onNavigate={handleMarkdownNavigate}
                onDispatchComplete={reloadModel}
                onSendToTerminal={sendToTerminal}
                onBeforeDispatch={openAgentPanel}
                onModelChanged={reloadModel}
                paperPath={paperPath}
                dualPaneSplit={dualPaneSplit}
                onDualPaneSplitChange={setDualPaneSplit}
              />
            ) : unitPath || activeFile ? (
              <EditorWorkspace
                unitPath={unitPath}
                activeFile={activeFile ?? (unitPath ? outlinePathFor(unitPath) : "")}
                refreshVersion={refreshVersion}
                layout={editorLayout}
                onLayoutChange={setEditorLayout}
                onError={setError}
                linkContextPath={unitPath ?? parentPath(activeFile ?? "")}
                onNavigate={handleMarkdownNavigate}
                dualPaneSplit={dualPaneSplit}
                onDualPaneSplitChange={setDualPaneSplit}
                onSendToTerminal={sendToTerminal}
                onBeforeDispatch={openAgentPanel}
                onDispatchComplete={reloadModel}
                onBackToSectionView={
                  showPaperViewBack || showSectionViewBack ? backToSectionView : undefined
                }
                backLabel={showPaperViewBack ? "Paper view" : "Section view"}
                isFigure={isFigure}
                isEquation={isEquation}
                onModelChanged={reloadModel}
                paperPath={paperPath}
              />
            ) : sectionPath ? (
              <SectionWorkspace
                sectionPath={sectionPath}
                refreshVersion={refreshVersion}
                onNavigate={navigateTo}
                onOpenFile={openFile}
                onError={setError}
                dualPaneSplit={dualPaneSplit}
                onDualPaneSplitChange={setDualPaneSplit}
                onDispatchComplete={reloadModel}
              />
            ) : (
              <FolderBrowse
                tree={tree}
                currentPath={browsePath}
                onOpenFolder={navigateTo}
                onOpenFile={openFile}
                onChanged={reloadModel}
                onError={setError}
                onSendToTerminal={sendToTerminal}
                onNavigate={handleMarkdownNavigate}
              />
            )}
          </div>

          <footer className="flex h-9 shrink-0 items-center gap-2 border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <div className="min-w-0 shrink sm:hidden">
                <Breadcrumbs
                  path={browsePath}
                  onNavigate={navigateTo}
                  compact
                  variant={sidebarTab === "papers" ? "papers" : "default"}
                />
              </div>
              <span className="hidden truncate sm:inline">
                {commentSummary && commentSummary.unresolved > 0
                  ? `${commentSummary.unresolved} unresolved comment${commentSummary.unresolved === 1 ? "" : "s"}`
                  : `${files.length} files · autosave on`}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {canCreateFolder ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={`New ${containerKind}`}
                  onClick={() => createChild(containerKind)}
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ) : null}
              {canCreateUnit ? (
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
                disabled={!canGoUp}
                onClick={() => navigateTo(parentPath(browsePath))}
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            <span className="hidden max-w-xs truncate shrink-0 sm:inline" title={gitSync?.lastError ?? undefined}>
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
          open={agentPanelOpen}
          onOpenChange={setAgentPanelOpen}
          currentPath={browsePath}
          refreshVersion={refreshVersion}
          isUnit={isUnit}
          canFanOut={isPaperSection && !isUnit}
          onSendToTerminal={sendToTerminal}
          onError={setError}
          onReconnect={reconnectTerminal}
          onLayoutChange={refitTerminal}
          terminalHostRef={terminalElementRef}
        />
      </div>
      )}

      <NamePromptDialog
        open={createPrompt !== null}
        title={createPrompt ? `New ${createPrompt.kind}` : "New node"}
        label="Folder-safe name (lowercase, hyphens ok)"
        confirmLabel="Create"
        onConfirm={(name) => void submitCreateChild(name)}
        onCancel={() => setCreatePrompt(null)}
      />

      {error ? (
        <div className="fixed bottom-3 right-3 flex max-w-lg items-start gap-2 rounded-lg border border-destructive/40 bg-background px-3 py-2 text-xs text-destructive shadow-lg">
          <span className="min-w-0 flex-1 whitespace-pre-wrap">{error}</span>
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
            <button type="button" className="underline" onClick={() => setError(null)}>
              dismiss
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
