import { useCallback, type Dispatch, type SetStateAction } from "react";

import {
  findNode,
  isUnderPapers,
  isUnitFolder,
  outlinePathFor,
  parentPath,
  PAPERS_ROOT,
  resolveModelPathTarget,
  type ModelNode,
  type NavigateTarget,
} from "@/lib/modelTree";
import type { EditorLayout } from "@/components/editor/MarkdownEditor";
import type { WorkspaceNavTab } from "@/components/nav/WorkspaceNav";

export type OpenFileOptions = {
  citeKey?: string;
};

export type NavigateFromTargetDeps = {
  openFile: (path: string, options?: OpenFileOptions) => void;
  navigateTo: (path: string) => void;
  tree?: ModelNode[];
};

/**
 * Resolve a NavigateTarget to the right workspace action. Pure helper shared by
 * the markdown editor, paper, and section workspaces so link-click behavior
 * stays consistent.
 */
export function navigateFromTarget(
  target: NavigateTarget,
  { openFile, navigateTo, tree }: NavigateFromTargetDeps,
): void {
  if (target.type === "bib") {
    openFile("main.bib", { citeKey: target.citeKey });
    return;
  }
  if (target.type === "file") {
    openFile(target.path);
    return;
  }
  if (tree) {
    const resolved = resolveModelPathTarget(tree, target.path);
    if (resolved?.type === "file") {
      openFile(resolved.path);
      return;
    }
    if (resolved) {
      navigateTo(resolved.path);
      return;
    }
  }
  navigateTo(target.path);
}

type UseWorkspaceNavigationOptions = {
  tree: ModelNode[];
  sidebarTab: WorkspaceNavTab;
  lastPaperPath: string | null;
  setCurrentPath: Dispatch<SetStateAction<string>>;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  setEditorLayout: Dispatch<SetStateAction<EditorLayout>>;
  setSidebarTab: Dispatch<SetStateAction<WorkspaceNavTab>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSelectedBibCiteKey: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceNavigation({
  tree,
  sidebarTab,
  lastPaperPath,
  setCurrentPath,
  setActiveFile,
  setEditorLayout,
  setSidebarTab,
  setSearchQuery,
  setSelectedBibCiteKey,
}: UseWorkspaceNavigationOptions) {
  const openFile = useCallback(
    (path: string, options?: OpenFileOptions) => {
      const folder = parentPath(path);
      setCurrentPath((current) => {
        if (folder === "" && path.toLowerCase().endsWith(".bib")) {
          if (isUnderPapers(current)) return current;
          if (lastPaperPath && isUnderPapers(lastPaperPath)) return lastPaperPath;
          return PAPERS_ROOT;
        }
        const nextPath =
          sidebarTab === "papers" && folder !== "" && !isUnderPapers(folder) ? PAPERS_ROOT : folder;
        return nextPath;
      });
      setActiveFile(path);
      setEditorLayout("split");
      if (options?.citeKey) {
        setSelectedBibCiteKey(options.citeKey);
      }
    },
    [lastPaperPath, setActiveFile, setCurrentPath, setEditorLayout, setSelectedBibCiteKey, sidebarTab],
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
    [openFile, setActiveFile, setCurrentPath, setEditorLayout, sidebarTab, tree],
  );

  const handleMarkdownNavigate = useCallback(
    (target: NavigateTarget) => {
      navigateFromTarget(target, { openFile, navigateTo, tree });
    },
    [navigateTo, openFile, tree],
  );

  const backToSectionView = useCallback(() => {
    setActiveFile(null);
  }, [setActiveFile]);

  const handleSidebarTabChange = useCallback(
    (tab: WorkspaceNavTab) => {
      setSidebarTab(tab);
      if (tab === "papers") {
        setCurrentPath((path) => (isUnderPapers(path) ? path : PAPERS_ROOT));
        setActiveFile(null);
      }
    },
    [setActiveFile, setCurrentPath, setSidebarTab],
  );

  const handleSearchSelect = useCallback(
    (hit: { path: string }) => {
      if (hit.path.endsWith(".md")) {
        openFile(hit.path);
      } else {
        navigateTo(parentPath(hit.path));
      }
      setSearchQuery("");
    },
    [navigateTo, openFile, setSearchQuery],
  );

  return {
    openFile,
    navigateTo,
    handleMarkdownNavigate,
    backToSectionView,
    handleSidebarTabChange,
    handleSearchSelect,
  };
}
