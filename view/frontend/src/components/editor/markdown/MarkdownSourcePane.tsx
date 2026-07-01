import { EditorFocusToggle } from "@/components/editor/EditorFocusToggle";
import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";
import type { TextHighlightColorId } from "@/lib/textHighlight";
import { cn } from "@/lib/utils";
import type { CSSProperties, RefObject } from "react";

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

export function MarkdownSourcePane({
  compact,
  readingFocusActive,
  textZoomStyle,
  sourceScrollRef,
  sourceRef,
  canUndo,
  canRedo,
  undo,
  redo,
  textZoomControl,
  statusText,
  unitStatus,
  toolbarProps,
  applyFormat,
  insertInlineNote,
  insertTextHighlight,
  insertSnippet,
  content,
  diffBaseline,
  showInlinePendingHighlights,
  disableSourceMirrors = false,
  filePath,
  setContent,
  assetAutocomplete,
  updateSelectedLine,
  onTextareaKeyDown,
  editorPlaceholder: _editorPlaceholder = "Write here…",
  commentLines,
  activeCommentLine = null,
}: {
  compact: boolean;
  readingFocusActive: boolean;
  textZoomStyle: CSSProperties;
  sourceScrollRef: RefObject<HTMLDivElement | null>;
  sourceRef: RefObject<HTMLTextAreaElement | null>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  textZoomControl: React.ReactNode;
  statusText: string;
  unitStatus: string | null;
  toolbarProps: ToolbarProps;
  applyFormat: (action: MarkdownFormatAction, targetPane: "source") => void;
  insertInlineNote: (targetPane: "source") => void;
  insertTextHighlight: (color: TextHighlightColorId, targetPane: "source") => void;
  insertSnippet: (snippet: string, targetPane: "source") => void;
  content: string;
  diffBaseline: string;
  showInlinePendingHighlights: boolean;
  disableSourceMirrors?: boolean;
  filePath: string;
  setContent: (value: string) => void;
  assetAutocomplete: {
    sync: (textarea: HTMLTextAreaElement) => Promise<void>;
    handleEditorBlur: (textarea: HTMLTextAreaElement) => void;
  };
  updateSelectedLine: () => void;
  onTextareaKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  editorPlaceholder?: string;
  commentLines?: Set<number>;
  activeCommentLine?: number | null;
}) {
  return (
    <div
      ref={sourceScrollRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col bg-editor editor-text-zoom-root",
        compact && "overflow-auto",
        compact && readingFocusActive && "reading-focus-pane markdown-pane",
      )}
      style={textZoomStyle}
    >
      {!compact && !readingFocusActive ? (
        <>
          <div className="ui-pane-header shrink-0">
            <span className="ui-label">Source</span>
            <div className="flex items-center gap-1.5">
              <EditorUndoRedoButtons canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
              <EditorFocusToggle className="h-7 px-2" />
              {textZoomControl}
              <span className="font-mono text-ui-2xs text-muted-foreground">
                {statusText}
                {unitStatus ? ` · ${unitStatus}` : ""}
              </span>
            </div>
          </div>
          <MarkdownToolbar
            {...toolbarProps}
            renderedMode={false}
            onFormat={(action) => applyFormat(action, "source")}
            onInsertInlineNote={() => insertInlineNote("source")}
            onInsertHighlight={(color) => insertTextHighlight(color, "source")}
            onInsertSnippet={(snippet) => insertSnippet(snippet, "source")}
          />
        </>
      ) : null}
      <HighlightingTextarea
        fillContainer={!compact}
        inputRef={sourceRef}
        className={cn(
          "w-full font-mono text-[13px] leading-6",
          compact ? "min-h-[8rem] p-4" : "min-h-0 flex-1 p-4",
        )}
        mirrorClassName="p-4 font-mono text-[13px] leading-6"
        value={content}
        baseline={disableSourceMirrors ? content : diffBaseline}
        highlight={showInlinePendingHighlights && !disableSourceMirrors}
        showTextHighlights={!disableSourceMirrors}
        commentLines={commentLines}
        activeCommentLine={activeCommentLine}
        spellCheck={false}
        aria-label={`Edit source ${filePath}`}
        onChange={(e) => {
          setContent(e.target.value);
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onSelect={(e) => {
          updateSelectedLine();
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onKeyUp={(e) => {
          updateSelectedLine();
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onClick={(e) => {
          updateSelectedLine();
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onFocus={(e) => void assetAutocomplete.sync(e.currentTarget)}
        onBlur={(e) => assetAutocomplete.handleEditorBlur(e.currentTarget)}
        onKeyDown={onTextareaKeyDown}
      />
    </div>
  );
}
