import { useLayoutEffect } from "react";

import { EditorPaneToggleHost } from "@/components/editor/EditorPaneToggle";
import {
  countVisibleEditorPanes,
  type EditorVisiblePanes,
} from "@/lib/editorVisiblePanes";
import { useReadingFocus } from "@/lib/readingFocus";
import type { DualPaneActive } from "@/lib/workspacePreferences";

export function useReadingFocusSplitPaneTitles(visiblePanes: EditorVisiblePanes): boolean {
  return countVisibleEditorPanes(visiblePanes) >= 2;
}

export function ReadingFocusExtra({
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  showNotes = true,
}: {
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  showNotes?: boolean;
}) {
  const { setExtraChrome } = useReadingFocus();

  useLayoutEffect(() => {
    setExtraChrome(
      <EditorPaneToggleHost
        visiblePanes={visiblePanes}
        onVisiblePanesChange={onVisiblePanesChange}
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
        showNotes={showNotes}
      />,
    );
    return () => setExtraChrome(null);
  }, [
    activePane,
    onActivePaneChange,
    onVisiblePanesChange,
    setExtraChrome,
    showNotes,
    visiblePanes,
  ]);

  return null;
}
