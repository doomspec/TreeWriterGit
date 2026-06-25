import { DispatchAiButton } from "@/components/editor/DispatchAiButton";
import { EditorFocusToggle } from "@/components/editor/EditorFocusToggle";
import { EditorPaneOverflowMenu } from "@/components/editor/EditorPaneOverflowMenu";
import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { ReadingFocusEditBar } from "@/components/editor/ReadingFocusEditBar";
import { dispatchActionLabel, type AgentDispatchAction, type DispatchProgressState } from "@/lib/agentDispatchClient";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";
import type { TextHighlightColorId } from "@/lib/textHighlight";
import type { RefObject } from "react";

type ToolbarProps = {
  renderedMode: boolean;
  commentsOpen: boolean;
  unresolvedComments: number;
  paperPath?: string | null;
  filePath: string;
  refreshVersion: number;
  onFormat: (action: MarkdownFormatAction) => void;
  onToggleComments: () => void;
  onInsertInlineNote: () => void;
  onInsertHighlight: (color: TextHighlightColorId) => void;
  onInsertSnippet: (snippet: string) => void;
};

export function MarkdownCompactEditBar({
  title,
  editorScopeRef,
  readingFocusActive,
  renderedEditable,
  toolbarProps,
  focusToolbarTarget,
  applyFormat,
  insertInlineNote,
  insertTextHighlight,
  insertSnippet,
  modeToggle,
  canDispatch,
  dispatchAction,
  dispatching,
  dispatchProgress,
  handleOpenAiDispatch,
  headerExtra,
  unitStatus,
  statusText,
  canUndo,
  canRedo,
  undo,
  redo,
  editorStats,
  textZoomControl,
}: {
  title: string;
  editorScopeRef: RefObject<HTMLDivElement | null>;
  readingFocusActive: boolean;
  renderedEditable: boolean;
  toolbarProps: ToolbarProps;
  focusToolbarTarget: "preview" | "source";
  applyFormat: (action: MarkdownFormatAction, targetPane: "preview" | "source") => void;
  insertInlineNote: (targetPane: "preview" | "source") => void;
  insertTextHighlight: (color: TextHighlightColorId, targetPane: "preview" | "source") => void;
  insertSnippet: (snippet: string, targetPane: "preview" | "source") => void;
  modeToggle: React.ReactNode;
  canDispatch: boolean;
  dispatchAction: AgentDispatchAction | null;
  dispatching: boolean;
  dispatchProgress: DispatchProgressState | null;
  handleOpenAiDispatch: () => void;
  headerExtra?: React.ReactNode;
  unitStatus: string | null;
  statusText: string;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  editorStats: { words: number; characters: number };
  textZoomControl: React.ReactNode;
}) {
  return (
    <ReadingFocusEditBar
      title={title}
      editorScopeRef={editorScopeRef}
      concealUntilSelection={readingFocusActive}
      useInlineToolbar={readingFocusActive}
      toolbar={
        <MarkdownToolbar
          {...toolbarProps}
          embedded
          renderedMode={focusToolbarTarget === "preview" && renderedEditable}
          onFormat={(action) => applyFormat(action, focusToolbarTarget)}
          onInsertInlineNote={() => insertInlineNote(focusToolbarTarget)}
          onInsertHighlight={(color) => insertTextHighlight(color, focusToolbarTarget)}
          onInsertSnippet={(snippet) => insertSnippet(snippet, focusToolbarTarget)}
        />
      }
      trailing={
        readingFocusActive ? (
          <>
            {renderedEditable ? modeToggle : null}
            {canDispatch && dispatchAction ? (
              <DispatchAiButton
                actionLabel={dispatchActionLabel(dispatchAction)}
                dispatching={dispatching}
                progress={dispatchProgress}
                onClick={handleOpenAiDispatch}
              />
            ) : null}
            {headerExtra}
          </>
        ) : (
          <>
            {modeToggle}
            <EditorPaneOverflowMenu
              statusText={unitStatus ? `${statusText} · ${unitStatus}` : statusText}
            >
              <div className="px-1 py-1">
                <EditorUndoRedoButtons
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                />
              </div>
              <div className="px-1 py-1">
                <EditorFocusToggle />
              </div>
              <div className="px-1 py-1 font-mono text-[10px] text-muted-foreground">
                {editorStats.words} words · {editorStats.characters} chars
              </div>
              <div className="px-1 py-1">{textZoomControl}</div>
              {canDispatch && dispatchAction ? (
                <div className="px-1 py-1">
                  <DispatchAiButton
                    actionLabel={dispatchActionLabel(dispatchAction)}
                    dispatching={dispatching}
                    progress={dispatchProgress}
                    onClick={handleOpenAiDispatch}
                  />
                </div>
              ) : null}
              {headerExtra ? <div className="px-1 py-1">{headerExtra}</div> : null}
            </EditorPaneOverflowMenu>
          </>
        )
      }
    />
  );
}
