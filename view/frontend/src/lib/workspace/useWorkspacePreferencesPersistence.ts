import { useEffect } from "react";

import type { EditorLayout } from "@/lib/editor/layout";
import type { GraphScope } from "@/lib/graphLocal";
import type { WorkspaceNavTab } from "@/components/nav/WorkspaceNav";
import {
  scheduleSaveWorkspacePreferences,
  type SidebarPanel,
} from "@/lib/workspacePreferences";
import type { EditorPaneScopePrefs } from "@/lib/editorPaneScopePrefs";

export type WorkspacePreferencesSnapshot = {
  sidebarTab: WorkspaceNavTab;
  currentPath: string;
  activeFile: string | null;
  editorLayout: EditorLayout;
  agentPanelOpen: boolean;
  searchQuery: string;
  graphRoot: string | null;
  graphScope: GraphScope;
  dualPaneSplit: number;
  dualPaneNotesSplitPercent: number;
  assetPreviewSplit: number;
  sidebarWidth: number;
  sidebarPanel: SidebarPanel;
  sidebarPanelOpen: boolean;
  sidebarPinned: boolean;
  bottomPanelHeight: number;
  lastPaperPath: string | null;
  editorPanePrefsByScope: Record<string, EditorPaneScopePrefs>;
};

/** Debounced persistence for workspace layout and navigation preferences. */
export function useWorkspacePreferencesPersistence(snapshot: WorkspacePreferencesSnapshot): void {
  useEffect(() => {
    scheduleSaveWorkspacePreferences(snapshot);
  }, [
    snapshot.activeFile,
    snapshot.agentPanelOpen,
    snapshot.assetPreviewSplit,
    snapshot.bottomPanelHeight,
    snapshot.currentPath,
    snapshot.dualPaneSplit,
    snapshot.dualPaneNotesSplitPercent,
    snapshot.editorLayout,
    snapshot.graphRoot,
    snapshot.graphScope,
    snapshot.editorPanePrefsByScope,
    snapshot.lastPaperPath,
    snapshot.searchQuery,
    snapshot.sidebarTab,
    snapshot.sidebarPanel,
    snapshot.sidebarPanelOpen,
    snapshot.sidebarPinned,
    snapshot.sidebarWidth,
  ]);
}
