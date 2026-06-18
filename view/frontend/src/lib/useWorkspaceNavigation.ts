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

type UseWorkspaceNavigationOptions = {
  tree: ModelNode[];
  sidebarTab: WorkspaceNavTab;
  setCurrentPath: Dispatch<SetStateAction<string>>;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  setEditorLayout: Dispatch<SetStateAction<EditorLayout>>;
  setSidebarTab: Dispatch<SetStateAction<WorkspaceNavTab>>;
};

export function useWorkspaceNavigation({
  tree,
  sidebarTab,
  setCurrentPath,
  setActiveFile,
  setEditorLayout,
  setSidebarTab,
}: UseWorkspaceNavigationOptions) {
  const openFile = useCallback(
    (path: string) => {
      const folder = parentPath(path);
      const nextPath =
        sidebarTab === "papers" && folder !== "" && !isUnderPapers(folder) ? PAPERS_ROOT : folder;
      setCurrentPath(nextPath);
      setActiveFile(path);
      setEditorLayout("split");
    },
    [setActiveFile, setCurrentPath, setEditorLayout, sidebarTab],
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
    },
    [navigateTo, openFile],
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
