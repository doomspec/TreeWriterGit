import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  ArrowUp,
  FilePlus,
  FolderPlus,
  GitBranch,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RightPanel } from "@/components/layout/RightPanel";
import { Sidebar, type SidebarTab } from "@/components/layout/Sidebar";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { SectionWorkspace } from "@/components/editor/SectionWorkspace";
import type { EditorLayout } from "@/components/editor/MarkdownEditor";
import { FolderBrowse } from "@/components/nav/FolderBrowse";
import {
  findNode,
  flattenFiles,
  isSectionContainer,
  isUnitFolder,
  outlinePathFor,
  parentPath,
  PAPERS_ROOT,
  type ModelNode,
  type NavigateTarget,
} from "@/lib/modelTree";
import { createNode, fetchCommentSummary, type NodeKind } from "@/modelApi";
import { GraphPanel } from "@/GraphPanel";
import { PapersPanel } from "@/PapersPanel";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  saveWorkspacePreferences,
} from "@/lib/workspacePreferences";
import type { GraphScope } from "@/lib/graphLocal";

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
  conflictDetected?: boolean;
};

export default function App() {
  const savedPrefs = useMemo(() => mergeWorkspaceDefaults(loadWorkspacePreferences()), []);
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [sessionKey, setSessionKey] = useState(0);
  const [tree, setTree] = useState<ModelNode[]>([]);
  const [currentPath, setCurrentPath] = useState(savedPrefs.currentPath);
  const [activeFile, setActiveFile] = useState<string | null>(savedPrefs.activeFile);
  const [editorLayout, setEditorLayout] = useState<EditorLayout>(savedPrefs.editorLayout);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(savedPrefs.sidebarTab);
  const [searchQuery, setSearchQuery] = useState(savedPrefs.searchQuery);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [gitSync, setGitSync] = useState<GitSyncState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentPanelOpen, setAgentPanelOpen] = useState(savedPrefs.agentPanelOpen);
  const [dualPaneSplit, setDualPaneSplit] = useState(savedPrefs.dualPaneSplit);
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
  const currentNode = browsePath ? findNode(tree, browsePath) : null;
  const isUnit = isUnitFolder(currentNode);
  const isPaperSection = isSectionContainer(currentNode) && isUnderPapers(browsePath);
  const unitPath = isUnit ? browsePath : null;
  const sectionPath = isPaperSection && !activeFile ? browsePath : null;
  const graphRoot = sidebarTab === "papers" ? browsePath : currentPath;

  useEffect(() => {
    saveWorkspacePreferences({
      sidebarTab,
      currentPath,
      activeFile,
      editorLayout,
      agentPanelOpen,
      searchQuery,
      graphRoot,
      graphScope,
      dualPaneSplit,
    });
  }, [
    activeFile,
    agentPanelOpen,
    currentPath,
    dualPaneSplit,
    editorLayout,
    graphRoot,
    graphScope,
    searchQuery,
    sidebarTab,
  ]);

  const loadTree = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/model/tree`);
    if (!response.ok) throw new Error(`Failed to load model tree: ${response.status}`);
    const data = (await response.json()) as { tree: ModelNode[] };
    setTree(data.tree);
  }, []);

  const loadGitSyncStatus = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/git-sync/status`);
    if (response.ok) setGitSync((await response.json()) as GitSyncState);
  }, []);

  const reloadModel = useCallback(() => {
    loadTree().catch(() => {});
    setRefreshVersion((v) => v + 1);
  }, [loadTree]);

  const navigateTo = useCallback(
    (path: string) => {
      const nextPath =
        sidebarTab === "papers" && path !== "" && !isUnderPapers(path) ? PAPERS_ROOT : path;
      setCurrentPath(nextPath);
      const node = nextPath ? findNode(tree, nextPath) : null;
      if (isUnitFolder(node)) {
        setActiveFile(outlinePathFor(nextPath));
        setEditorLayout("split");
      } else {
        setActiveFile(null);
      }
    },
    [sidebarTab, tree],
  );

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

  const handleMarkdownNavigate = useCallback(
    (target: NavigateTarget) => {
      if (target.type === "file") {
        openFile(target.path);
        return;
      }
      navigateTo(target.path);
    },
    [navigateTo, openFile],
  );

  const handleSidebarTabChange = useCallback((tab: SidebarTab) => {
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
    if (browsePath && (!currentNode || currentNode.type !== "directory")) {
      if (sidebarTab === "papers") {
        setCurrentPath(PAPERS_ROOT);
      } else {
        setCurrentPath("");
      }
      setActiveFile(null);
    }
  }, [browsePath, currentNode, sidebarTab]);

  useEffect(() => {
    if (sidebarTab === "papers" && !isUnderPapers(currentPath)) {
      setCurrentPath(PAPERS_ROOT);
      setActiveFile(null);
    }
  }, [currentPath, sidebarTab]);

  useEffect(() => {
    if (isUnit) {
      setActiveFile(outlinePathFor(browsePath));
      setEditorLayout("split");
    }
  }, [browsePath, isUnit]);

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
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: "#0f1113",
        foreground: "#e8eaed",
        cursor: "#ffffff",
        selectionBackground: "#3b4754",
      },
    });
    const fitAddon = new FitAddon();
    const socket = new WebSocket(terminalUrl);

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
      if (typeof event.data === "string") terminal.write(event.data);
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
  }, [refitTerminal, sessionKey, sidebarTab, currentPath, activeFile, agentPanelOpen]);

  const sendToTerminal = useCallback((command: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", data: command }));
    }
  }, []);

  const runGitSync = async () => {
    const response = await fetch(`${apiBaseUrl}/api/git-sync/run`, { method: "POST" });
    if (response.ok) setGitSync((await response.json()) as GitSyncState);
  };

  const containerKind: NodeKind =
    browsePath === "" || /(^|\/)sections$/.test(browsePath) ? "section" : "subsection";
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

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">TreeWriter</span>
          </div>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <div className="hidden min-w-0 sm:block">
            <Breadcrumbs path={browsePath} onNavigate={navigateTo} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              gitSync?.conflictDetected
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
          >
            git {gitStatusLabel}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            terminal {connectionState}
          </span>
          <Button
            type="button"
            variant={agentPanelOpen ? "default" : "outline"}
            size="icon"
            title={agentPanelOpen ? "Hide AI dispatch & terminal" : "Show AI dispatch & terminal"}
            aria-label={agentPanelOpen ? "Hide agent panel" : "Show agent panel"}
            aria-pressed={agentPanelOpen}
            onClick={() => setAgentPanelOpen((open) => !open)}
          >
            {agentPanelOpen ? (
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button type="button" variant="outline" size="icon" title="Git sync" onClick={() => void runGitSync()}>
            <GitBranch className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="icon" title="Refresh" onClick={() => reloadModel()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <section className={agentPanelOpen ? "workspace-grid grid min-h-0 min-w-0 flex-1" : "workspace-grid workspace-grid--agent-collapsed grid min-h-0 min-w-0 flex-1"}>
        <Sidebar
          tree={tree}
          currentPath={browsePath}
          activeFile={activeFile}
          activeTab={sidebarTab}
          searchQuery={searchQuery}
          onTabChange={handleSidebarTabChange}
          onSearchChange={setSearchQuery}
          onNavigate={navigateTo}
          onOpenFile={openFile}
          onSearchSelect={handleSearchSelect}
          papersContent={
            <PapersPanel
              embedded
              tree={tree}
              currentPath={currentPath}
              onNavigate={(path) => navigateTo(path)}
              onModelChanged={reloadModel}
              onPaperCreated={(path) => {
                reloadModel();
                navigateTo(path);
                setSidebarTab("papers");
              }}
              onError={setError}
            />
          }
          graphContent={
            <div className="graph-tab-host flex min-h-[280px] flex-1 flex-col overflow-hidden">
              <GraphPanel
                embedded
                root={graphRoot}
                graphScope={graphScope}
                onGraphScopeChange={setGraphScope}
                onSelectNode={(id) => {
                  if (!id.startsWith("missing:")) {
                    navigateTo(id);
                    setSidebarTab("explorer");
                  }
                }}
              />
            </div>
          }
        />

        <section className="relative grid min-h-0 grid-rows-[auto_1fr_auto] bg-[hsl(var(--workspace-bg))]">
          <div className="flex h-11 items-center justify-between gap-3 border-b border-border bg-card px-4">
            <div className="flex min-w-0 items-center gap-2 sm:hidden">
              <Breadcrumbs path={currentPath} onNavigate={navigateTo} />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={`New ${containerKind}`}
                onClick={() => createChild(containerKind)}
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="icon" title="New unit" onClick={() => createChild("unit")}>
                <FilePlus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Up one level"
                disabled={!canGoUp}
                onClick={() => navigateTo(parentPath(browsePath))}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {unitPath || activeFile ? (
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

          <footer className="flex h-8 items-center justify-between border-t border-border bg-card px-4 text-[11px] text-muted-foreground">
            <span>
              {commentSummary && commentSummary.unresolved > 0
                ? `${commentSummary.unresolved} unresolved comment${commentSummary.unresolved === 1 ? "" : "s"}`
                : `${files.length} files · autosave on`}
            </span>
            <span>
              {gitSync?.conflictDetected
                ? "Resolve git conflict in terminal"
                : gitSync?.lastSuccessAt
                  ? `Synced ${new Date(gitSync.lastSuccessAt).toLocaleTimeString()}`
                  : "Awaiting sync"}
            </span>
          </footer>
        </section>

        <RightPanel
          open={agentPanelOpen}
          onOpenChange={setAgentPanelOpen}
          currentPath={browsePath}
          refreshVersion={refreshVersion}
          isUnit={isUnit}
          canFanOut={isPaperSection && !isUnit}
          onSendToTerminal={sendToTerminal}
          onError={setError}
          onReconnect={() => setSessionKey((k) => k + 1)}
          onLayoutChange={refitTerminal}
          terminalHostRef={terminalElementRef}
        />
      </section>

      <NamePromptDialog
        open={createPrompt !== null}
        title={createPrompt ? `New ${createPrompt.kind}` : "New node"}
        label="Folder-safe name (lowercase, hyphens ok)"
        confirmLabel="Create"
        onConfirm={(name) => void submitCreateChild(name)}
        onCancel={() => setCreatePrompt(null)}
      />

      {error ? (
        <div className="fixed bottom-3 right-3 flex max-w-md items-center gap-2 rounded-lg border border-destructive/40 bg-background px-3 py-2 text-xs text-destructive shadow-lg">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className="shrink-0 underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      ) : null}
    </main>
  );
}
