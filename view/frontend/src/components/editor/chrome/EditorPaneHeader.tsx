import type { ReactNode } from "react";

import { EditorFocusToggle } from "@/components/editor/EditorFocusToggle";
import { EditorPaneModeToggle } from "@/components/editor/EditorPaneModeToggle";
import { EditorPaneOverflowMenu } from "@/components/editor/EditorPaneOverflowMenu";
import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { TextZoomControl } from "@/components/editor/TextZoomControl";
import type { EditorPaneMode } from "@/lib/editorSessionState";

export type EditorPaneHeaderProps = {
  paneLabel: string;
  paneMode: EditorPaneMode;
  onPaneModeChange: (mode: EditorPaneMode) => void;
  reviewMode?: boolean;
  /** There is a pending-approval diff that could be shown or hidden. */
  pendingDiffAvailable?: boolean;
  /** When true, the inline tracked-changes diff is suppressed (clean read). */
  cleanPreview?: boolean;
  onCleanPreviewChange?: (clean: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  wordCount: number;
  charCount: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  statusText?: string;
  headerExtra?: ReactNode;
  readingFocusActive?: boolean;
};

/** Shared pane header controls for markdown and composed draft editors. */
export function EditorPaneHeader({
  paneLabel,
  paneMode,
  onPaneModeChange,
  reviewMode,
  pendingDiffAvailable,
  cleanPreview,
  onCleanPreviewChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  wordCount,
  charCount,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  statusText,
  headerExtra,
  readingFocusActive = false,
}: EditorPaneHeaderProps) {
  const modeToggle = (
    <EditorPaneModeToggle
      paneMode={paneMode}
      onPaneModeChange={onPaneModeChange}
      ariaLabel={`${paneLabel} editing mode`}
      reviewMode={reviewMode}
      pendingDiffAvailable={pendingDiffAvailable}
      cleanPreview={cleanPreview}
      onCleanPreviewChange={onCleanPreviewChange}
    />
  );

  if (readingFocusActive) {
    return (
      <>
        {modeToggle}
        {headerExtra}
      </>
    );
  }

  return (
    <>
      {modeToggle}
      <EditorPaneOverflowMenu statusText={statusText}>
        <div className="px-1 py-1">
          <EditorUndoRedoButtons
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        </div>
        <div className="px-1 py-1">
          <EditorFocusToggle />
        </div>
        <div className="px-1 py-1 font-mono text-[10px] text-muted-foreground">
          {wordCount} words · {charCount} chars
        </div>
        <div className="px-1 py-1">
          <TextZoomControl zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onZoomReset} />
        </div>
        {headerExtra ? <div className="px-1 py-1">{headerExtra}</div> : null}
      </EditorPaneOverflowMenu>
    </>
  );
}
