import { useEffect } from "react";

import type { EditorLayout } from "@/lib/editor/layout";
import type { GraphScope } from "@/lib/graphLocal";
import {
  scheduleSaveWorkspacePreferences,
  type SidebarPanel,
} from "@/lib/workspacePreferences";
import type { EditorPaneScopePrefs } from "@/lib/editorPaneScopePrefs";

export type WorkspacePreferencesSnapshot = {
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
  explorerMode: boolean;
  explorerOpenTabs: string[];
  explorerActiveTab: string | null;
  aiPanelOpen: boolean;
  aiPanelWidth: number;
  aiPanelTerminalOpen: boolean;
  aiPanelDispatchOpen: boolean;
  aiPanelSkillsOpen: boolean;
};

/** Debounced persistence for workspace layout and navigation preferences. */
export function useWorkspacePreferencesPersistence(snapshot: WorkspacePreferencesSnapshot): void {
  useEffect(() => {
    scheduleSaveWorkspacePreferences({
      ...snapshot,
      graphRoot: snapshot.graphRoot ?? "",
    });
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
    snapshot.sidebarPanel,
    snapshot.sidebarPanelOpen,
    snapshot.sidebarPinned,
    snapshot.sidebarWidth,
    snapshot.explorerMode,
    snapshot.explorerOpenTabs,
    snapshot.explorerActiveTab,
    snapshot.aiPanelOpen,
    snapshot.aiPanelWidth,
    snapshot.aiPanelTerminalOpen,
    snapshot.aiPanelDispatchOpen,
    snapshot.aiPanelSkillsOpen,
  ]);
}
