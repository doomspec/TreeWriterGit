import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { EditorLayout } from "@/components/editor/MarkdownEditor";
import type { WorkspaceNavTab } from "@/components/nav/WorkspaceNav";
import type { AgentDispatchIntent } from "@/lib/agentDispatchPanel";
import type { GraphScope } from "@/lib/graphLocal";
import { resolveGraphFetchRoot } from "@/lib/graphLocal";
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
import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  scheduleSaveWorkspacePreferences,
  type DualPaneActive,
  type DualPaneView,
} from "@/lib/workspacePreferences";
import { useModelTree } from "@/lib/useModelTree";
import { useWorkspaceNavigation } from "@/lib/useWorkspaceNavigation";

export type AppView = "workspace" | "settings" | "info";

export type WorkspaceContextValue = {
  appView: AppView;
  setAppView: (view: AppView | ((prev: AppView) => AppView)) => void;
  error: string | null;
  setError: (message: string | null) => void;
  sidebarTab: WorkspaceNavTab;
  currentPath: string;
  activeFile: string | null;
  editorLayout: EditorLayout;
  setEditorLayout: (layout: EditorLayout) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  agentPanelOpen: boolean;
  setAgentPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  dispatchIntent: AgentDispatchIntent | null;
  setDispatchIntent: (intent: AgentDispatchIntent | null) => void;
  clearDispatchIntent: () => void;
  dualPaneSplit: number;
  setDualPaneSplit: (split: number) => void;
  dualPaneView: DualPaneView;
  setDualPaneView: (view: DualPaneView) => void;
  dualPaneActive: DualPaneActive;
  setDualPaneActive: (pane: DualPaneActive) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (height: number) => void;
  graphScope: GraphScope;
  setGraphScope: (scope: GraphScope) => void;
  createPrompt: { kind: NodeKind } | null;
  setCreatePrompt: (prompt: { kind: NodeKind } | null) => void;
  commentSummary: { unresolved: number; total: number } | null;
  tree: ReturnType<typeof useModelTree>["tree"];
  treeLoaded: boolean;
  refreshVersion: number;
  getPathVersion: (path: string) => number;
  reloadModel: () => void;
  files: ReturnType<typeof flattenFiles>;
  browsePath: string;
  paperSlug: string | null;
  paperPath: string | null;
  currentNode: ReturnType<typeof findNode>;
  isFigure: boolean;
  isTable: boolean;
  isEquation: boolean;
  isUnit: boolean;
  isPaperRoot: boolean;
  isPaperSection: boolean;
  paperWorkspacePath: string | null;
  tablePath: string | null;
  tableTitle: string;
  unitPath: string | null;
  sectionPath: string | null;
  graphFocusPath: string;
  graphFetchRoot: string | null;
  exportPaperSlug: string | null;
  showSectionViewBack: boolean;
  showPaperViewBack: boolean;
  containerKind: NodeKind;
  canCreateFolder: boolean;
  canCreateUnit: boolean;
  canGoUp: boolean;
  openFile: ReturnType<typeof useWorkspaceNavigation>["openFile"];
  navigateTo: ReturnType<typeof useWorkspaceNavigation>["navigateTo"];
  handleMarkdownNavigate: ReturnType<typeof useWorkspaceNavigation>["handleMarkdownNavigate"];
  backToSectionView: ReturnType<typeof useWorkspaceNavigation>["backToSectionView"];
  handleSidebarTabChange: ReturnType<typeof useWorkspaceNavigation>["handleSidebarTabChange"];
  handleSearchSelect: ReturnType<typeof useWorkspaceNavigation>["handleSearchSelect"];
  submitCreateChild: (name: string) => Promise<void>;
  onModelEventsRefresh: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({
  children,
  onModelEventsRefresh,
}: {
  children: ReactNode;
  onModelEventsRefresh?: () => void;
}) {
  const savedPrefs = useMemo(() => mergeWorkspaceDefaults(loadWorkspacePreferences()), []);

  const [currentPath, setCurrentPath] = useState(savedPrefs.currentPath);
  const [activeFile, setActiveFile] = useState<string | null>(savedPrefs.activeFile);
  const [editorLayout, setEditorLayout] = useState<EditorLayout>(savedPrefs.editorLayout);
  const [sidebarTab, setSidebarTab] = useState<WorkspaceNavTab>(savedPrefs.sidebarTab);
  const [searchQuery, setSearchQuery] = useState(savedPrefs.searchQuery);
  const [appView, setAppView] = useState<AppView>("workspace");
  const [error, setError] = useState<string | null>(null);
  const [agentPanelOpen, setAgentPanelOpen] = useState(savedPrefs.agentPanelOpen);
  const [dispatchIntent, setDispatchIntent] = useState<AgentDispatchIntent | null>(null);
  const [dualPaneSplit, setDualPaneSplit] = useState(savedPrefs.dualPaneSplit);
  const [dualPaneView, setDualPaneView] = useState<DualPaneView>(savedPrefs.dualPaneView);
  const [dualPaneActive, setDualPaneActive] = useState<DualPaneActive>(savedPrefs.dualPaneActive);
  const [sidebarWidth, setSidebarWidth] = useState(savedPrefs.sidebarWidth);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(savedPrefs.bottomPanelHeight);
  const [graphScope, setGraphScope] = useState<GraphScope>(savedPrefs.graphScope);
  const [createPrompt, setCreatePrompt] = useState<{ kind: NodeKind } | null>(null);
  const [commentSummary, setCommentSummary] = useState<{ unresolved: number; total: number } | null>(
    null,
  );

  const commentSummaryPaperRef = useRef<string | null>(null);

  const onCommentsChanged = useCallback(() => {
    const slug = commentSummaryPaperRef.current;
    if (!slug) return;
    fetchCommentSummary(slug).then(setCommentSummary).catch(() => {});
  }, []);

  const { tree, treeLoaded, refreshVersion, getPathVersion, reloadModel } = useModelTree({
    onError: setError,
    onEventsRefresh: onModelEventsRefresh,
    onCommentsChanged,
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
  commentSummaryPaperRef.current = paperSlug;
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
    scheduleSaveWorkspacePreferences({
      sidebarTab,
      currentPath,
      activeFile,
      editorLayout,
      agentPanelOpen,
      searchQuery,
      graphRoot: graphFocusPath,
      graphScope,
      dualPaneSplit,
      dualPaneView,
      dualPaneActive,
      sidebarWidth,
      bottomPanelHeight,
    });
  }, [
    activeFile,
    agentPanelOpen,
    bottomPanelHeight,
    currentPath,
    dualPaneActive,
    dualPaneSplit,
    dualPaneView,
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
    if (!treeLoaded || !activeFile) return;
    const fileNode = findNode(tree, activeFile);
    if (fileNode?.type === "file") return;
    setActiveFile(null);
  }, [activeFile, tree, treeLoaded]);

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
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [paperSlug]);

  const clearDispatchIntent = useCallback(() => setDispatchIntent(null), []);

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

  const submitCreateChild = useCallback(
    async (name: string) => {
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
    },
    [browsePath, createPrompt, navigateTo, reloadModel],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      appView,
      setAppView,
      error,
      setError,
      sidebarTab,
      currentPath,
      activeFile,
      editorLayout,
      setEditorLayout,
      searchQuery,
      setSearchQuery,
      agentPanelOpen,
      setAgentPanelOpen,
      dispatchIntent,
      setDispatchIntent,
      clearDispatchIntent,
      dualPaneSplit,
      setDualPaneSplit,
      dualPaneView,
      setDualPaneView,
      dualPaneActive,
      setDualPaneActive,
      sidebarWidth,
      setSidebarWidth,
      bottomPanelHeight,
      setBottomPanelHeight,
      graphScope,
      setGraphScope,
      createPrompt,
      setCreatePrompt,
      commentSummary,
      tree,
      treeLoaded,
      refreshVersion,
      getPathVersion,
      reloadModel,
      files,
      browsePath,
      paperSlug,
      paperPath,
      currentNode,
      isFigure,
      isTable,
      isEquation,
      isUnit,
      isPaperRoot,
      isPaperSection,
      paperWorkspacePath,
      tablePath,
      tableTitle,
      unitPath,
      sectionPath,
      graphFocusPath,
      graphFetchRoot,
      exportPaperSlug,
      showSectionViewBack,
      showPaperViewBack,
      containerKind,
      canCreateFolder,
      canCreateUnit,
      canGoUp,
      openFile,
      navigateTo,
      handleMarkdownNavigate,
      backToSectionView,
      handleSidebarTabChange,
      handleSearchSelect,
      submitCreateChild,
      onModelEventsRefresh: onModelEventsRefresh ?? (() => {}),
    }),
    [
      activeFile,
      agentPanelOpen,
      appView,
      backToSectionView,
      bottomPanelHeight,
      browsePath,
      canCreateFolder,
      canCreateUnit,
      canGoUp,
      clearDispatchIntent,
      commentSummary,
      containerKind,
      createPrompt,
      currentNode,
      currentPath,
      dispatchIntent,
      dualPaneActive,
      dualPaneSplit,
      dualPaneView,
      editorLayout,
      error,
      exportPaperSlug,
      files,
      getPathVersion,
      graphFetchRoot,
      graphFocusPath,
      graphScope,
      handleMarkdownNavigate,
      handleSearchSelect,
      handleSidebarTabChange,
      isEquation,
      isFigure,
      isPaperRoot,
      isPaperSection,
      isTable,
      isUnit,
      navigateTo,
      onModelEventsRefresh,
      openFile,
      paperPath,
      paperSlug,
      paperWorkspacePath,
      refreshVersion,
      reloadModel,
      searchQuery,
      sectionPath,
      showPaperViewBack,
      showSectionViewBack,
      sidebarTab,
      sidebarWidth,
      submitCreateChild,
      tablePath,
      tableTitle,
      tree,
      treeLoaded,
      unitPath,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
