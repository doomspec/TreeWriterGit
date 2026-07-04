import { createContext, useContext, type ReactNode } from "react";

import type { CommentRecord, CommentSummary } from "@treewriter/shared";
import type { GraphScope } from "@/lib/graphLocal";
import type { AgentDispatchIntent } from "@/lib/agentDispatchPanel";
import type { NodeKind } from "@/lib/api/modelApi";
import type { SidebarPanel } from "@/lib/workspacePreferences";
import type { useModelTree } from "@/lib/useModelTree";
import type { useWorkspaceNavigation } from "@/lib/useWorkspaceNavigation";
import type { OpenFileOptions } from "@/lib/useWorkspaceNavigation";
import type { findNode } from "@/lib/modelTree";

export type WorkspaceNavigationContextValue = {
  sidebarPanel: SidebarPanel;
  sidebarPanelOpen: boolean;
  setSidebarPanel: (panel: SidebarPanel) => void;
  setSidebarPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebarPanel: () => void;
  cycleSidebarPanelLayout: () => void;
  sidebarPinned: boolean;
  setSidebarPinned: (pinned: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebarPin: () => void;
  currentPath: string;
  activeFile: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dispatchIntent: AgentDispatchIntent | null;
  setDispatchIntent: (intent: AgentDispatchIntent | null) => void;
  clearDispatchIntent: () => void;
  graphScope: GraphScope;
  setGraphScope: (scope: GraphScope) => void;
  createPrompt: { kind: NodeKind } | null;
  setCreatePrompt: (prompt: { kind: NodeKind } | null) => void;
  commentSummary: CommentSummary | null;
  assignedComments: CommentRecord[];
  assignedCountsByFolder: Map<string, number>;
  reloadComments: () => Promise<void>;
  tree: ReturnType<typeof useModelTree>["tree"];
  treeLoaded: boolean;
  refreshVersion: number;
  getPathVersion: (path: string) => number;
  reloadModel: ReturnType<typeof useModelTree>["reloadModel"];
  loadTreePath: ReturnType<typeof useModelTree>["loadTreePath"];
  files: ReturnType<typeof import("@/lib/modelTree").flattenFiles>;
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
  openFile: (path: string, options?: OpenFileOptions) => void;
  navigateTo: ReturnType<typeof useWorkspaceNavigation>["navigateTo"];
  handleMarkdownNavigate: ReturnType<typeof useWorkspaceNavigation>["handleMarkdownNavigate"];
  backToSectionView: ReturnType<typeof useWorkspaceNavigation>["backToSectionView"];
  focusSectionsPanel: () => void;
  focusPaperInfoPanel: () => void;
  handleSearchSelect: ReturnType<typeof useWorkspaceNavigation>["handleSearchSelect"];
  submitCreateChild: (name: string) => Promise<void>;
  lastPaperPath: string | null;
  editorPaneScopePath: string | null;
  dualPaneEditorActive: boolean;
  notesPaneAvailable: boolean;
  /** Selected cite key when main.bib is open. */
  selectedBibCiteKey: string | null;
  setSelectedBibCiteKey: (citeKey: string | null) => void;
  /** Insert snippet into the active editor (registered by MarkdownEditor). */
  insertEditorSnippet: ((snippet: string) => void) | null;
  registerEditorInsertSnippet: (fn: ((snippet: string) => void) | null) => void;
  /** INDEX child_order for folders under the active paper (loaded once per paper). */
  paperChildOrders: Record<string, string[]>;
};

const WorkspaceNavigationContext = createContext<WorkspaceNavigationContextValue | null>(null);

export { WorkspaceNavigationContext };

export function WorkspaceNavigationProvider({
  value,
  children,
}: {
  value: WorkspaceNavigationContextValue;
  children: ReactNode;
}) {
  return (
    <WorkspaceNavigationContext.Provider value={value}>{children}</WorkspaceNavigationContext.Provider>
  );
}

export function useWorkspaceNavigationContext(): WorkspaceNavigationContextValue {
  const ctx = useContext(WorkspaceNavigationContext);
  if (!ctx) throw new Error("useWorkspaceNavigationContext must be used within WorkspaceProvider");
  return ctx;
}
