import { createContext, useContext, type ReactNode } from "react";

import type { EditorLayout } from "@/lib/editor/layout";
import type { DualPaneActive, EditorVisiblePanes } from "@/lib/workspacePreferences";

export type WorkspaceLayoutContextValue = {
  editorLayout: EditorLayout;
  setEditorLayout: (layout: EditorLayout) => void;
  dualPaneSplit: number;
  setDualPaneSplit: (split: number) => void;
  editorVisiblePanes: EditorVisiblePanes;
  setEditorVisiblePanes: (panes: EditorVisiblePanes) => void;
  dualPaneActive: DualPaneActive;
  setDualPaneActive: (pane: DualPaneActive) => void;
  dualPaneNotesSplitPercent: number;
  setDualPaneNotesSplitPercent: (split: number) => void;
  assetPreviewSplit: number;
  setAssetPreviewSplit: (split: number) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (height: number) => void;
  agentPanelOpen: boolean;
  setAgentPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
};

const WorkspaceLayoutContext = createContext<WorkspaceLayoutContextValue | null>(null);

export function WorkspaceLayoutProvider({
  value,
  children,
}: {
  value: WorkspaceLayoutContextValue;
  children: ReactNode;
}) {
  return <WorkspaceLayoutContext.Provider value={value}>{children}</WorkspaceLayoutContext.Provider>;
}

export function useWorkspaceLayout(): WorkspaceLayoutContextValue {
  const ctx = useContext(WorkspaceLayoutContext);
  if (!ctx) throw new Error("useWorkspaceLayout must be used within WorkspaceProvider");
  return ctx;
}
