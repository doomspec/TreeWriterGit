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
import type { EditorLayout } from "@/lib/editor/layout";
import type { WorkspaceNavTab } from "@/components/nav/WorkspaceNav";
import type { AgentDispatchIntent } from "@/lib/agentDispatchPanel";
import type { GraphScope } from "@/lib/graphLocal";
import { resolveGraphFetchRoot } from "@/lib/graphLocal";
import { paperRootFromPath } from "@/components/nav/PaperSelect";
import {
  findNode,
  flattenFiles,
  isFigureFolder,
  isEquationFolder,
  isSectionContainer,
  isTableFolder,
  isUnderPapers,
  isUnitFolder,
  isManuscriptFileForContainer,
  manuscriptContainerPathFromFile,
  outlinePathFor,
  parentPath,
  PAPERS_ROOT,
} from "@/lib/modelTree";
import { createNode, type NodeKind } from "@/modelApi";
import { usePaperComments } from "@/lib/hooks/usePaperComments";
import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  clampAssetPreviewSplit,
  clampDualPaneNotesSplit,
  type DualPaneActive,
  type EditorVisiblePanes,
  type SidebarPanel,
} from "@/lib/workspacePreferences";
import { useWorkspacePreferencesPersistence } from "@/lib/workspace/useWorkspacePreferencesPersistence";
import {
  clampEditorPanePrefsForNotesAvailability,
  DEFAULT_EDITOR_VISIBLE_PANES,
  normalizeEditorVisiblePanes,
} from "@/lib/editorVisiblePanes";
import { usePaperChildOrders } from "@/lib/usePaperChildOrders";
import {
  upsertEditorPanePrefsByScope,
  resolveEditorPanePrefsScopePath,
  type EditorPaneScopePrefs,
} from "@/lib/editorPaneScopePrefs";
import { ensurePathLoaded } from "@/lib/model/modelTreeMerge";
import { useModelTree } from "@/lib/useModelTree";
import { useWorkspaceNavigation } from "@/lib/useWorkspaceNavigation";
import {
  WorkspaceLayoutProvider,
  type WorkspaceLayoutContextValue,
} from "@/lib/workspace/WorkspaceLayoutContext";
import {
  WorkspaceNavigationProvider,
  type WorkspaceNavigationContextValue,
} from "@/lib/workspace/WorkspaceNavigationContext";

export type AppView = "workspace" | "settings" | "info";

/** Root workspace shell state not covered by layout/navigation sub-contexts. */
export type WorkspaceContextValue = {
  appView: AppView;
  setAppView: (view: AppView | ((prev: AppView) => AppView)) => void;
  error: string | null;
  setError: (message: string | null) => void;
  onModelEventsRefresh: () => void;
  /** IDE-style Explorer workspace toggle (project-root file editing). */
  explorerMode: boolean;
  setExplorerMode: (on: boolean | ((prev: boolean) => boolean)) => void;
  explorerOpenTabs: string[];
  explorerActiveTab: string | null;
  /** Open a file in an Explorer tab (adds if missing) and make it active. */
  openExplorerTab: (path: string) => void;
  /** Close an Explorer tab; activates a neighbor if the closed tab was active. */
  closeExplorerTab: (path: string) => void;
  setExplorerActiveTab: (path: string | null) => void;
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
  // Every live navigation path (openFile, unit browsing) force-resets editorLayout
  // to "split" on arrival. Boot hydration restores the raw persisted value instead,
  // so reloading with main.bib last-active could restore a stale non-split layout
  // (e.g. "preview") and hide the source/verification pane until the next navigation.
  // Apply the same forced-split rule here so a bib file never boots into that state.
  const [editorLayout, setEditorLayout] = useState<EditorLayout>(
    savedPrefs.activeFile?.toLowerCase().endsWith(".bib") ? "split" : savedPrefs.editorLayout,
  );
  const [sidebarTab, setSidebarTab] = useState<WorkspaceNavTab>(
    savedPrefs.sidebarPanel === "explorer" ? "explorer" : savedPrefs.sidebarTab,
  );
  const [sidebarPanel, setSidebarPanelState] = useState<SidebarPanel>(savedPrefs.sidebarPanel);
  const [sidebarPanelOpen, setSidebarPanelOpen] = useState(savedPrefs.sidebarPanelOpen);
  const [sidebarPinned, setSidebarPinned] = useState(savedPrefs.sidebarPinned);
  const [searchQuery, setSearchQuery] = useState(savedPrefs.searchQuery);
  const [appView, setAppView] = useState<AppView>("workspace");
  const [error, setError] = useState<string | null>(null);
  const [explorerMode, setExplorerMode] = useState<boolean>(savedPrefs.explorerMode ?? false);
  const [explorerOpenTabs, setExplorerOpenTabs] = useState<string[]>(
    savedPrefs.explorerOpenTabs ?? [],
  );
  const [explorerActiveTab, setExplorerActiveTab] = useState<string | null>(
    savedPrefs.explorerActiveTab ?? null,
  );
  const [agentPanelOpen, setAgentPanelOpen] = useState(savedPrefs.agentPanelOpen);
  const [dispatchIntent, setDispatchIntent] = useState<AgentDispatchIntent | null>(null);
  const [dualPaneSplit, setDualPaneSplit] = useState(savedPrefs.dualPaneSplit);
  const [editorVisiblePanes, setEditorVisiblePanesState] = useState<EditorVisiblePanes>(
    normalizeEditorVisiblePanes(savedPrefs.editorVisiblePanes),
  );
  const setEditorVisiblePanes = useCallback((panes: EditorVisiblePanes) => {
    setEditorVisiblePanesState(normalizeEditorVisiblePanes(panes));
  }, []);
  const [dualPaneActive, setDualPaneActive] = useState<DualPaneActive>(savedPrefs.dualPaneActive);
  const [dualPaneNotesSplitPercent, setDualPaneNotesSplitPercentState] = useState(
    savedPrefs.dualPaneNotesSplitPercent,
  );
  const setDualPaneNotesSplitPercent = useCallback((split: number) => {
    setDualPaneNotesSplitPercentState(clampDualPaneNotesSplit(split));
  }, []);
  const [assetPreviewSplit, setAssetPreviewSplitState] = useState(savedPrefs.assetPreviewSplit);
  const setAssetPreviewSplit = useCallback((split: number) => {
    setAssetPreviewSplitState(clampAssetPreviewSplit(split));
  }, []);
  const [sidebarWidth, setSidebarWidth] = useState(savedPrefs.sidebarWidth);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(savedPrefs.bottomPanelHeight);
  const [graphScope, setGraphScope] = useState<GraphScope>(savedPrefs.graphScope);
  const [createPrompt, setCreatePrompt] = useState<{ kind: NodeKind } | null>(null);
  const [lastPaperPath, setLastPaperPath] = useState<string | null>(() => {
    if (savedPrefs.lastPaperPath && /^papers\/[^/]+$/.test(savedPrefs.lastPaperPath)) {
      return savedPrefs.lastPaperPath;
    }
    return paperRootFromPath(savedPrefs.currentPath ?? "");
  });
  const [editorPanePrefsByScope, setEditorPanePrefsByScope] = useState<
    Record<string, EditorPaneScopePrefs>
  >(savedPrefs.editorPanePrefsByScope ?? {});
  const [selectedBibCiteKey, setSelectedBibCiteKey] = useState<string | null>(null);
  const editorInsertSnippetRef = useRef<((snippet: string) => void) | null>(null);
  const registerEditorInsertSnippet = useCallback((fn: ((snippet: string) => void) | null) => {
    editorInsertSnippetRef.current = fn;
  }, []);
  const insertEditorSnippet = useCallback((snippet: string) => {
    editorInsertSnippetRef.current?.(snippet);
  }, []);
  const scopePaneLoadRef = useRef(false);
  const editorPanePrefsByScopeRef = useRef(editorPanePrefsByScope);
  editorPanePrefsByScopeRef.current = editorPanePrefsByScope;

  const reloadCommentsRef = useRef<(() => Promise<void>) | null>(null);

  const onCommentsChanged = useCallback(() => {
    void reloadCommentsRef.current?.();
  }, []);

  const { tree, treeLoaded, refreshVersion, getPathVersion, reloadModel, ensureTreePath, loadTreePath } =
    useModelTree({
      onError: setError,
      onEventsRefresh: onModelEventsRefresh,
      onCommentsChanged,
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
  const paperChildOrders = usePaperChildOrders(tree, paperPath, refreshVersion);

  const { commentSummary, assignedComments, assignedCountsByFolder, reloadComments } =
    usePaperComments({
      paperSlug,
      paperPath,
      tree,
      refreshVersion,
    });

  reloadCommentsRef.current = reloadComments;

  const {
    openFile,
    navigateTo,
    handleMarkdownNavigate,
    backToSectionView,
    handleSearchSelect,
  } = useWorkspaceNavigation({
    tree,
    sidebarTab,
    lastPaperPath,
    setCurrentPath,
    setActiveFile,
    setEditorLayout,
    setSidebarTab,
    setSearchQuery,
    setSelectedBibCiteKey,
  });

  const handleSidebarTabChange = useCallback(
    (tab: WorkspaceNavTab) => {
      setSidebarTab(tab);
      setSidebarPanelState(tab);
      setSidebarPanelOpen(true);
      if (tab === "papers") {
        setCurrentPath((path) => (isUnderPapers(path) ? path : PAPERS_ROOT));
        setActiveFile(null);
      }
    },
    [setActiveFile, setCurrentPath],
  );

  const setSidebarPanel = useCallback(
    (panel: SidebarPanel) => {
      if (panel === sidebarPanel) {
        setSidebarPanelOpen((open) => !open);
        return;
      }
      setSidebarPanelState(panel);
      setSidebarPanelOpen(true);
      if (panel === "explorer") {
        setSidebarTab("explorer");
      } else if (panel === "papers" || panel === "references") {
        setSidebarTab("papers");
        setCurrentPath((path) => (isUnderPapers(path) ? path : PAPERS_ROOT));
        if (panel === "papers") {
          setActiveFile(null);
        }
      }
    },
    [sidebarPanel, setActiveFile, setCurrentPath, setSidebarTab],
  );

  const toggleSidebarPanel = useCallback(() => {
    setSidebarPanelOpen((open) => !open);
  }, []);

  const toggleSidebarPin = useCallback(() => {
    setSidebarPinned((pinned) => !pinned);
  }, []);

  useEffect(() => {
    if (!treeLoaded || !paperPath) return;
    void ensureTreePath(paperPath);
  }, [ensureTreePath, paperPath, treeLoaded]);

  useEffect(() => {
    if (!treeLoaded || !isUnderPapers(browsePath)) return;
    void ensureTreePath(browsePath);
  }, [browsePath, ensureTreePath, treeLoaded]);

  const currentNode = browsePath ? findNode(tree, browsePath) : null;
  const isFigure = isFigureFolder(currentNode);
  const isTable = isTableFolder(currentNode);
  const isEquation = isEquationFolder(currentNode);
  const isUnit = isUnitFolder(currentNode);
  const isPaperRoot = paperPath !== null && browsePath === paperPath;
  const isPaperSection = isSectionContainer(currentNode) && isUnderPapers(browsePath);
  const manuscriptFileContainer = manuscriptContainerPathFromFile(activeFile);
  const paperWorkspacePath =
    paperPath && isPaperRoot && (!activeFile || isManuscriptFileForContainer(activeFile, paperPath))
      ? paperPath
      : null;
  const tablePath = isTable ? browsePath : null;
  const tableTitle = useMemo(() => {
    if (!tablePath) return "Table";
    const base = tablePath.split("/").pop() ?? "table";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }, [tablePath]);
  const unitPath = isUnit || isFigure || isEquation ? browsePath : null;
  const sectionPath = useMemo(() => {
    if (isPaperRoot || isUnit || isFigure || isTable || isEquation) return null;
    if (!activeFile) {
      return isPaperSection ? browsePath : null;
    }
    if (!manuscriptFileContainer) return null;
    const containerNode = findNode(tree, manuscriptFileContainer);
    if (!isSectionContainer(containerNode)) return null;
    if (
      isUnitFolder(containerNode) ||
      isFigureFolder(containerNode) ||
      isTableFolder(containerNode) ||
      isEquationFolder(containerNode)
    ) {
      return null;
    }
    return manuscriptFileContainer;
  }, [
    activeFile,
    browsePath,
    isEquation,
    isFigure,
    isPaperRoot,
    isPaperSection,
    isTable,
    isUnit,
    manuscriptFileContainer,
    tree,
  ]);
  const editorPaneScopePath =
    paperWorkspacePath ?? sectionPath ?? unitPath ?? tablePath ?? null;
  const editorPanePrefsScopePath = useMemo(
    () => resolveEditorPanePrefsScopePath(editorPaneScopePath, paperPath),
    [editorPaneScopePath, paperPath],
  );
  const dualPaneEditorActive = Boolean(editorPaneScopePath);
  const notesPaneAvailable = Boolean(
    paperWorkspacePath || sectionPath || unitPath,
  );
  const graphFocusPath = activeFile ? parentPath(activeFile) : currentPath || browsePath;
  const graphFetchRoot = resolveGraphFetchRoot(graphFocusPath);
  const exportPaperSlug = paperSlug;

  useEffect(() => {
    const root = paperRootFromPath(currentPath);
    if (root) setLastPaperPath(root);
  }, [currentPath]);

  useEffect(() => {
    if (!editorPanePrefsScopePath) return;
    const scoped = editorPanePrefsByScopeRef.current[editorPanePrefsScopePath];
    scopePaneLoadRef.current = true;
    if (scoped) {
      const clamped = clampEditorPanePrefsForNotesAvailability(
        scoped.visible,
        scoped.active,
        notesPaneAvailable,
      );
      setEditorVisiblePanesState(normalizeEditorVisiblePanes(clamped.visible));
      setDualPaneActive(clamped.active);
      return;
    }
    const fallback = clampEditorPanePrefsForNotesAvailability(
      DEFAULT_EDITOR_VISIBLE_PANES,
      "draft",
      notesPaneAvailable,
    );
    setEditorVisiblePanesState(fallback.visible);
    setDualPaneActive(fallback.active);
  }, [editorPanePrefsScopePath, notesPaneAvailable]);

  useEffect(() => {
    if (notesPaneAvailable) return;
    const clamped = clampEditorPanePrefsForNotesAvailability(
      editorVisiblePanes,
      dualPaneActive,
      false,
    );
    if (
      clamped.visible.outline !== editorVisiblePanes.outline ||
      clamped.visible.draft !== editorVisiblePanes.draft ||
      clamped.visible.notes !== editorVisiblePanes.notes ||
      clamped.active !== dualPaneActive
    ) {
      setEditorVisiblePanesState(clamped.visible);
      setDualPaneActive(clamped.active);
    }
  }, [dualPaneActive, editorVisiblePanes, notesPaneAvailable]);

  useEffect(() => {
    if (!editorPanePrefsScopePath) return;
    if (scopePaneLoadRef.current) {
      scopePaneLoadRef.current = false;
      return;
    }
    setEditorPanePrefsByScope((current) =>
      upsertEditorPanePrefsByScope(current, editorPanePrefsScopePath, {
        visible: editorVisiblePanes,
        active: dualPaneActive,
      }),
    );
  }, [dualPaneActive, editorPanePrefsScopePath, editorVisiblePanes]);

  useWorkspacePreferencesPersistence({
    sidebarTab,
    currentPath,
    activeFile,
    editorLayout,
    agentPanelOpen,
    searchQuery,
    graphRoot: graphFocusPath,
    graphScope,
    dualPaneSplit,
    dualPaneNotesSplitPercent,
    assetPreviewSplit,
    sidebarWidth,
    sidebarPanel,
    sidebarPanelOpen,
    sidebarPinned,
    bottomPanelHeight,
    lastPaperPath,
    editorPanePrefsByScope,
    explorerMode,
    explorerOpenTabs,
    explorerActiveTab,
  });

  const showSectionViewBack = Boolean(activeFile && isPaperSection && !isUnit && !isPaperRoot);
  const showPaperViewBack = Boolean(activeFile && isPaperRoot);

  useEffect(() => {
    if (!treeLoaded || !browsePath) return;
    if (currentNode?.type === "directory") return;

    // After a scoped tree reload the folder may be missing until lazy paths load.
    if (ensurePathLoaded(tree, browsePath).length > 0) {
      void ensureTreePath(browsePath);
      return;
    }

    if (sidebarTab === "papers") {
      setCurrentPath(PAPERS_ROOT);
    } else {
      setCurrentPath("");
    }
    setActiveFile(null);
  }, [browsePath, currentNode, ensureTreePath, sidebarTab, tree, treeLoaded]);

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
        reloadModel({ path: browsePath || paperPath || undefined });
        if (kind !== "unit") navigateTo(created.path);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [browsePath, createPrompt, navigateTo, paperPath, reloadModel],
  );

  const openExplorerTab = useCallback((path: string) => {
    setExplorerOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
    setExplorerActiveTab(path);
  }, []);

  const closeExplorerTab = useCallback((path: string) => {
    setExplorerOpenTabs((tabs) => {
      const index = tabs.indexOf(path);
      if (index === -1) return tabs;
      const next = tabs.filter((tab) => tab !== path);
      setExplorerActiveTab((active) => {
        if (active !== path) return active;
        // Activate the neighbor that slides into the closed slot.
        return next[index] ?? next[index - 1] ?? null;
      });
      return next;
    });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      appView,
      setAppView,
      error,
      setError,
      onModelEventsRefresh: onModelEventsRefresh ?? (() => {}),
      explorerMode,
      setExplorerMode,
      explorerOpenTabs,
      explorerActiveTab,
      openExplorerTab,
      closeExplorerTab,
      setExplorerActiveTab,
    }),
    [
      appView,
      error,
      onModelEventsRefresh,
      explorerMode,
      explorerOpenTabs,
      explorerActiveTab,
      openExplorerTab,
      closeExplorerTab,
    ],
  );

  const layoutValue = useMemo<WorkspaceLayoutContextValue>(
    () => ({
      editorLayout,
      setEditorLayout,
      dualPaneSplit,
      setDualPaneSplit,
      editorVisiblePanes,
      setEditorVisiblePanes,
      dualPaneActive,
      setDualPaneActive,
      dualPaneNotesSplitPercent,
      setDualPaneNotesSplitPercent,
      assetPreviewSplit,
      setAssetPreviewSplit,
      sidebarWidth,
      setSidebarWidth,
      bottomPanelHeight,
      setBottomPanelHeight,
      agentPanelOpen,
      setAgentPanelOpen,
    }),
    [
      agentPanelOpen,
      assetPreviewSplit,
      bottomPanelHeight,
      dualPaneActive,
      dualPaneSplit,
      editorVisiblePanes,
      dualPaneNotesSplitPercent,
      editorLayout,
      setAgentPanelOpen,
      setAssetPreviewSplit,
      setBottomPanelHeight,
      setDualPaneActive,
      setDualPaneNotesSplitPercent,
      setDualPaneSplit,
      setEditorLayout,
      setEditorVisiblePanes,
      setSidebarWidth,
      sidebarWidth,
    ],
  );

  const navigationValue = useMemo<WorkspaceNavigationContextValue>(
    () => ({
      sidebarTab,
      sidebarPanel,
      sidebarPanelOpen,
      setSidebarPanel,
      setSidebarPanelOpen,
      toggleSidebarPanel,
      sidebarPinned,
      setSidebarPinned,
      toggleSidebarPin,
      currentPath,
      activeFile,
      searchQuery,
      setSearchQuery,
      dispatchIntent,
      setDispatchIntent,
      clearDispatchIntent,
      graphScope,
      setGraphScope,
      createPrompt,
      setCreatePrompt,
      commentSummary,
      assignedComments,
      assignedCountsByFolder,
      reloadComments,
      tree,
      treeLoaded,
      refreshVersion,
      getPathVersion,
      reloadModel,
      loadTreePath,
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
      lastPaperPath,
      editorPaneScopePath,
      dualPaneEditorActive,
      notesPaneAvailable,
      selectedBibCiteKey,
      setSelectedBibCiteKey,
      insertEditorSnippet,
      registerEditorInsertSnippet,
      paperChildOrders,
    }),
    [
      activeFile,
      assignedComments,
      assignedCountsByFolder,
      backToSectionView,
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
      dualPaneEditorActive,
      editorPaneScopePath,
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
      lastPaperPath,
      loadTreePath,
      notesPaneAvailable,
      navigateTo,
      openFile,
      paperPath,
      paperChildOrders,
      paperSlug,
      paperWorkspacePath,
      refreshVersion,
      reloadComments,
      reloadModel,
      searchQuery,
      sectionPath,
      selectedBibCiteKey,
      setSelectedBibCiteKey,
      insertEditorSnippet,
      registerEditorInsertSnippet,
      showPaperViewBack,
      showSectionViewBack,
      sidebarPanel,
      sidebarPanelOpen,
      sidebarPinned,
      sidebarTab,
      submitCreateChild,
      tablePath,
      tableTitle,
      toggleSidebarPanel,
      toggleSidebarPin,
      tree,
      treeLoaded,
      unitPath,
    ],
  );

  return (
    <WorkspaceLayoutProvider value={layoutValue}>
      <WorkspaceNavigationProvider value={navigationValue}>
        <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
      </WorkspaceNavigationProvider>
    </WorkspaceLayoutProvider>
  );
}
