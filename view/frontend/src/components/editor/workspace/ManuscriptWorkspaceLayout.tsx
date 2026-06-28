import type { ReactNode, RefObject } from "react";

import {
  DualPaneController,
} from "@/components/editor/DualPaneController";
import type { DualPaneActive, EditorVisiblePanes } from "@/lib/workspacePreferences";

export type ManuscriptWorkspaceLayoutProps = {
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  notesSplitPercent: number;
  onNotesSplitChange: (percent: number) => void;
  outlinePane: ReactNode;
  draftPane: ReactNode;
  notesPane: ReactNode;
  containerRef?: RefObject<HTMLDivElement | null>;
};

/** Shared dual-pane shell for paper, section, and unit manuscript workspaces. */
export function ManuscriptWorkspaceLayout({
  dualPaneSplit,
  onDualPaneSplitChange,
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  notesSplitPercent,
  onNotesSplitChange,
  outlinePane,
  draftPane,
  notesPane,
  containerRef,
}: ManuscriptWorkspaceLayoutProps) {
  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <DualPaneController
        splitPercent={dualPaneSplit}
        onSplitChange={onDualPaneSplitChange}
        visiblePanes={visiblePanes}
        onVisiblePanesChange={onVisiblePanesChange}
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
        outlinePane={outlinePane}
        draftPane={draftPane}
        notesPane={notesPane}
        notesSplitPercent={notesSplitPercent}
        onNotesSplitChange={onNotesSplitChange}
      />
    </div>
  );
}
