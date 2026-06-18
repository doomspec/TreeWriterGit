import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
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
import type { GitSyncSettings } from "@/lib/settingsApi";
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
  isSectionContainer,
  isTableFolder,
  isUnitFolder,
  outlinePathFor,
  parentPath,
  PAPERS_ROOT,
  resolveModelPathTarget,
  type ModelNode,
  type NavigateTarget,
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
import { isViewSyncPaused } from "@/lib/gitSync";
import { resolveViewSyncWithHarness } from "@/lib/agentDispatchClient";
import {
  buildTerminalWebSocketUrl,
  clearTerminalSessionId,
  loadTerminalSessionId,
  parseTerminalSessionMessage,
  saveTerminalSessionId,
} from "@/lib/terminalSession";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const terminalUrl = import.meta.env.VITE_TERMINAL_WS_URL ?? "ws://localhost:4000/terminal";
const modelEventsUrl = import.meta.env.VITE_MODEL_EVENTS_WS_URL ?? "ws://localhost:4000/model-events";

function isUnderPapers(path: string): boolean {
  return path === PAPERS_ROOT || path.startsWith(`${PAPERS_ROOT}/`);
}

type ConnectionState = "connecting" | "connected" | "closed";

type GitSyncState = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastOutput?: string | null;
  conflictDetected?: boolean;
  autoSync?: boolean;
  intervalMs?: number;
  viewChangesBlocked?: boolean;
};

type AppView = "workspace" | "settings";

function formatGitSyncError(state: GitSyncState): string {
  const parts: string[] = [];
  if (state.conflictDetected) {
    parts.push("Git sync conflict detected.");
  }
  if (state.lastError?.trim()) {
    parts.push(state.lastError.trim());
  }
  if (state.lastOutput?.trim()) {
    parts.push(`---\n${state.lastOutput.trim()}`);
  }
  return parts.join("\n\n") || "Git sync failed.";
}

function gitSyncHasError(state: GitSyncState | null): boolean {
  return Boolean(state && (state.lastError || state.conflictDetected));
}

export default function App() {
  const savedPrefs = useMemo(() => mergeWorkspaceDefaults(loadWorkspacePreferences()), []);
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const terminalConnectRef = useRef<{ sessionId: string | null; forceNew: boolean }>({
    sessionId: loadTerminalSessionId(),
    forceNew: false,
  });

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [sessionKey, setSessionKey] = useState(0);
  const [tree, setTree] = useState<ModelNode[]>([]);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const [currentPath, setCurrentPath] = useState(savedPrefs.currentPath);
  const [activeFile, setActiveFile] = useState<string | null>(savedPrefs.activeFile);
  const [editorLayout, setEditorLayout] = useState<EditorLayout>(savedPrefs.editorLayout);
  const [sidebarTab, setSidebarTab] = useState<WorkspaceNavTab>(savedPrefs.sidebarTab);
  const [searchQuery, setSearchQuery] = useState(savedPrefs.searchQuery);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [gitSync, setGitSync] = useState<GitSyncState | null>(null);
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
  const unitPath = isUnit || isFigure ? browsePath : null;
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

  const loadTree = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/model/tree`);
    if (!response.ok) throw new Error(`Failed to load model tree: ${response.status}`);
    const data = (await response.json()) as { tree: ModelNode[] };
    setTree(data.tree);
    setTreeLoaded(true);
  }, []);

  const loadGitSyncStatus = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/git-sync/status`);
    if (response.ok) setGitSync((await response.json()) as GitSyncState);
  }, []);

  const handleGitSyncSettingsChange = useCallback((settings: GitSyncSettings) => {
    setGitSync({
      ...settings.status,
      autoSync: settings.autoSync,
      intervalMs: settings.intervalMs,
    });
  }, []);

  const reloadModel = useCallback(() => {
    loadTree().catch(() => {});
    setRefreshVersion((v) => v + 1);
  }, [loadTree]);

  const openFile = useCallback(
    (path: string) => {
      const folder = parentPath(path);
      const nextPath =
        sidebarTab === "papers" && folder !== "" && !isUnderPapers(folder) ? PAPERS_ROOT : folder;
      setCurrentPath(nextPath);
      setActiveFile(path);
      setEditorLayout("split");
    },
    [sidebarTab],
  );

  const navigateTo = useCallback(
    (path: string) => {
      const normalized =
        sidebarTab === "papers" && path !== "" && !isUnderPapers(path) ? PAPERS_ROOT : path;
      const target = resolveModelPathTarget(tree, normalized);
      if (!target) return;
      if (target.type === "file") {
        openFile(target.path);
        return;
      }
      setCurrentPath(target.path);
      const node = findNode(tree, target.path);
      if (isUnitFolder(node)) {
        setActiveFile(outlinePathFor(target.path));
        setEditorLayout("split");
      } else {
        setActiveFile(null);
      }
    },
    [openFile, sidebarTab, tree],
  );

  const handleMarkdownNavigate = useCallback(
    (target: NavigateTarget) => {
      const path = target.type === "file" ? target.path : target.path;
      const resolved = resolveModelPathTarget(tree, path);
      if (!resolved) return;
      if (resolved.type === "file") {
        openFile(resolved.path);
        return;
      }
      navigateTo(resolved.path);
    },
    [navigateTo, openFile, tree],
  );

  const backToSectionView = useCallback(() => {
    setActiveFile(null);
  }, []);

  const showSectionViewBack = Boolean(activeFile && isPaperSection && !isUnit && !isPaperRoot);
  const showPaperViewBack = Boolean(activeFile && isPaperRoot);

  const handleSidebarTabChange = useCallback((tab: WorkspaceNavTab) => {
    setSidebarTab(tab);
    if (tab === "papers") {
      setCurrentPath((path) => (isUnderPapers(path) ? path : PAPERS_ROOT));
      setActiveFile(null);
    }
  }, []);

  useEffect(() => {
    loadTree().catch((err) => setError(err instanceof Error ? err.message : String(err)));
    loadGitSyncStatus().catch(() => {});
  }, [loadGitSyncStatus, loadTree]);

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
    const socket = new WebSocket(modelEventsUrl);
    let reloadTimer: number | undefined;
    socket.addEventListener("message", () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        loadTree().catch(() => {});
        loadGitSyncStatus().catch(() => {});
        setRefreshVersion((v) => v + 1);
      }, 150);
    });
    return () => {
      window.clearTimeout(reloadTimer);
      socket.close();
    };
  }, [loadGitSyncStatus, loadTree]);

  useEffect(() => {
    const timer = window.setInterval(() => loadGitSyncStatus().catch(() => {}), 10_000);
    return () => window.clearInterval(timer);
  }, [loadGitSyncStatus]);

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

  useEffect(() => {
    if (!terminalElementRef.current) return;

    setConnectionState("connecting");
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 11,
      lineHeight: 1.3,
      theme: {
        background: "#0f1113",
        foreground: "#e8eaed",
        cursor: "#ffffff",
        selectionBackground: "#3b4754",
      },
    });
    const fitAddon = new FitAddon();
    const { sessionId, forceNew } = terminalConnectRef.current;
    const socket = new WebSocket(buildTerminalWebSocketUrl(terminalUrl, { sessionId, forceNew }));
    terminalConnectRef.current = { sessionId: loadTerminalSessionId(), forceNew: false };

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    socketRef.current = socket;

    terminal.loadAddon(fitAddon);
    terminal.open(terminalElementRef.current);
    fitAddon.fit();

    const sendResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
      }
    };

    const resizeObserver = new ResizeObserver(sendResize);
    resizeObserver.observe(terminalElementRef.current);

    const dataDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    socket.addEventListener("open", () => {
      setConnectionState("connected");
      sendResize();
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const sessionIdFromServer = parseTerminalSessionMessage(event.data);
      if (sessionIdFromServer) {
        saveTerminalSessionId(sessionIdFromServer);
        return;
      }
      terminal.write(event.data);
    });
    socket.addEventListener("close", () => {
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal disconnected]");
    });
    socket.addEventListener("error", () => {
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal websocket error]");
    });

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      socket.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      socketRef.current = null;
    };
  }, [sessionKey]);

  const refitTerminal = useCallback(() => {
    window.requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
      const terminal = terminalRef.current;
      const socket = socketRef.current;
      if (terminal && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
      }
    });
  }, []);

  useEffect(() => {
    refitTerminal();
    const onResize = () => refitTerminal();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [refitTerminal, sessionKey, sidebarTab, currentPath, activeFile, agentPanelOpen, sidebarWidth]);

  const sendToTerminal = useCallback((command: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", data: command }));
    }
  }, []);

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

  const runGitSync = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/git-sync/run`, { method: "POST" });
    if (!response.ok) {
      setError(`Git sync request failed (${response.status})`);
      return;
    }
    const state = (await response.json()) as GitSyncState;
    setGitSync(state);
    if (gitSyncHasError(state)) {
      setError(formatGitSyncError(state));
    }
  }, []);

  const handleGitBadgeClick = useCallback(() => {
    if (gitSync && gitSyncHasError(gitSync)) {
      setError(formatGitSyncError(gitSync));
      return;
    }
    void runGitSync();
  }, [gitSync, runGitSync]);

  const containerKind: NodeKind =
    paperPath && browsePath === paperPath
      ? "section"
      : browsePath === "" || /(^|\/)sections$/.test(browsePath)
        ? "section"
        : "subsection";
  const isLeafAssetOrUnit = isUnit || isFigure || isTable;
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

  const handleSearchSelect = useCallback(
    (hit: { path: string }) => {
      if (hit.path.endsWith(".md")) {
        openFile(hit.path);
      } else {
        navigateTo(parentPath(hit.path));
      }
    },
    [navigateTo, openFile],
  );

  const gitStatusLabel = gitSync?.conflictDetected
    ? "conflict"
    : gitSync?.lastError
      ? "error"
      : gitSync?.running
        ? "syncing"
        : gitSync?.enabled
          ? "ok"
          : "off";
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
          onReconnect={() => {
            const previousSessionId = loadTerminalSessionId();
            clearTerminalSessionId();
            terminalConnectRef.current = {
              sessionId: previousSessionId,
              forceNew: true,
            };
            setSessionKey((k) => k + 1);
          }}
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
