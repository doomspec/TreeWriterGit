import type { ReactNode } from "react";

import { ReadingFocusExtra } from "@/components/editor/ReadingFocusNavBar";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { ResizableVerticalSplit } from "@/components/layout/ResizableVerticalSplit";
import {
  countVisibleEditorPanes,
  isDraftNotesSplit,
  shouldSyncDocumentOutlineForPanes,
  type EditorPaneId,
  type EditorVisiblePanes,
} from "@/lib/editorVisiblePanes";
import { useReadingFocus } from "@/lib/readingFocus";
import type { DualPaneActive } from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

export function shouldSyncDocumentOutline(
  visiblePanes: EditorVisiblePanes,
  activePane: DualPaneActive,
): boolean {
  return shouldSyncDocumentOutlineForPanes(visiblePanes, activePane);
}

export function DualPanePane({
  pane,
  activePane,
  onActivePaneChange,
  className,
  children,
}: {
  pane: DualPaneActive;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
      onFocusCapture={() => onActivePaneChange(pane)}
      onMouseDown={() => onActivePaneChange(pane)}
    >
      {children}
    </div>
  );
}

function paneNode(
  id: EditorPaneId,
  outlinePane: ReactNode,
  draftPane: ReactNode,
  notesPane?: ReactNode,
): ReactNode {
  if (id === "outline") return outlinePane;
  if (id === "draft") return draftPane;
  return notesPane ?? draftPane;
}

function buildPaneLayout({
  visiblePanes,
  splitPercent,
  onSplitChange,
  notesSplitPercent,
  onNotesSplitChange,
  outlinePane,
  draftPane,
  notesPane,
  readingFocusActive,
}: {
  visiblePanes: EditorVisiblePanes;
  splitPercent: number;
  onSplitChange: (percent: number) => void;
  notesSplitPercent: number;
  onNotesSplitChange?: (percent: number) => void;
  outlinePane: ReactNode;
  draftPane: ReactNode;
  notesPane?: ReactNode;
  readingFocusActive: boolean;
}) {
  const count = countVisibleEditorPanes(visiblePanes);

  if (count === 1) {
    const sole = visiblePanes.outline ? outlinePane : visiblePanes.draft ? draftPane : notesPane ?? draftPane;
    return sole;
  }

  if (isDraftNotesSplit(visiblePanes)) {
    if (!notesPane) {
      return draftPane;
    }
    return (
      <ResizableVerticalSplit
        className="min-h-0 flex-1"
        splitPercent={notesSplitPercent}
        onSplitChange={onNotesSplitChange ?? (() => {})}
        handleLabel="Resize draft and notes"
        minPercent={20}
        maxPercent={75}
        top={draftPane}
        bottom={notesPane ?? draftPane}
      />
    );
  }

  const [leftId, rightId] = visiblePanes.outline
    ? (["outline", visiblePanes.draft ? "draft" : "notes"] as const)
    : (["draft", "notes"] as const);

  return (
    <ResizableDualPane
      splitPercent={splitPercent}
      onSplitChange={onSplitChange}
      className={readingFocusActive && count === 2 ? "reading-focus-dual-pane" : undefined}
      left={paneNode(leftId, outlinePane, draftPane, notesPane)}
      right={paneNode(rightId, outlinePane, draftPane, notesPane)}
    />
  );
}

export function DualPaneController({
  splitPercent,
  onSplitChange,
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  outlinePane,
  draftPane,
  notesPane,
  notesSplitPercent = 70,
  onNotesSplitChange,
  className,
}: {
  splitPercent: number;
  onSplitChange: (percent: number) => void;
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  outlinePane: ReactNode;
  draftPane: ReactNode;
  notesPane?: ReactNode;
  notesSplitPercent?: number;
  onNotesSplitChange?: (percent: number) => void;
  className?: string;
}) {
  const readingFocus = useReadingFocus();

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <ReadingFocusExtra
        visiblePanes={visiblePanes}
        onVisiblePanesChange={onVisiblePanesChange}
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
        showNotes={Boolean(notesPane)}
      />
      {buildPaneLayout({
        visiblePanes,
        splitPercent,
        onSplitChange,
        notesSplitPercent,
        onNotesSplitChange,
        outlinePane,
        draftPane,
        notesPane,
        readingFocusActive: readingFocus.active,
      })}
    </div>
  );
}
