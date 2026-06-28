import type { BlockMarkdownEditorHandle } from "@/components/editor/BlockMarkdownEditor";
import { EditorFocusToggle } from "@/components/editor/EditorFocusToggle";
import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { RenderedMarkdownField } from "@/components/editor/RenderedMarkdownField";
import { ReadingFocusDocumentLayout } from "@/components/editor/ReadingFocusDocumentLayout";
import { ReadingFocusTitleLink } from "@/components/editor/ReadingFocusTitleLink";
import type { DraftPendingSource } from "@/lib/draftApproval";
import type { FigureMetadata } from "@/lib/figures";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";
import type { NavigateTarget } from "@/lib/modelTree";
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

export function MarkdownPreviewPane({
  compact,
  readingFocusActive,
  textZoomStyle,
  bindOutlineScroll,
  previewRef,
  previewBlockRef,
  canUndo,
  canRedo,
  undo,
  redo,
  textZoomControl,
  statusText,
  modeToggle,
  renderedEditable,
  toolbarProps,
  applyFormat,
  insertInlineNote,
  insertTextHighlight,
  insertSnippet,
  previewMeta,
  focusTitleContextPath,
  onNavigate,
  previewBody,
  approvedPreviewBody,
  loadedPreviewBody,
  showInlinePendingHighlights,
  figureLabelIndex,
  approvalDisplay,
  handleApproveDraft,
  handleDiscardDraft,
  saveState,
  approvalLabel,
  filePath,
  paneLabel,
  linkContextPath,
  refreshVersion,
  activeOutlineNavPath = null,
  handlePreviewBodyChange,
  updateSelectedLine,
  assetAutocomplete,
  onPreviewKeyDown,
  debouncedPreviewBody,
  editorPlaceholder = "Write here…",
  commentLines,
  activeCommentLine = null,
}: {
  compact: boolean;
  readingFocusActive: boolean;
  textZoomStyle: CSSProperties;
  bindOutlineScroll: (el: HTMLElement | null) => void;
  previewRef: RefObject<HTMLTextAreaElement | null>;
  previewBlockRef: RefObject<BlockMarkdownEditorHandle | null>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  textZoomControl: React.ReactNode;
  statusText: string;
  modeToggle: React.ReactNode;
  renderedEditable: boolean;
  toolbarProps: ToolbarProps;
  applyFormat: (action: MarkdownFormatAction, targetPane: "preview") => void;
  insertInlineNote: (targetPane: "preview") => void;
  insertTextHighlight: (color: TextHighlightColorId, targetPane: "preview") => void;
  insertSnippet: (snippet: string, targetPane: "preview") => void;
  previewMeta: { title: string | null; body: string };
  focusTitleContextPath: string;
  onNavigate?: (target: NavigateTarget) => void;
  previewBody: string;
  approvedPreviewBody: string;
  loadedPreviewBody: string;
  showInlinePendingHighlights: boolean;
  figureLabelIndex: Map<string, FigureMetadata>;
  approvalDisplay: {
    editedBy: string | null;
    pendingSource: DraftPendingSource | null;
    aiAssisted: boolean;
    aiProvider: string | null;
  };
  handleApproveDraft: () => void | Promise<void>;
  handleDiscardDraft: () => void | Promise<void>;
  saveState: string;
  approvalLabel: string;
  filePath: string;
  paneLabel?: string;
  linkContextPath: string;
  refreshVersion: number;
  activeOutlineNavPath?: string | null;
  handlePreviewBodyChange: (body: string) => void;
  updateSelectedLine: () => void;
  assetAutocomplete: {
    sync: (textarea: HTMLTextAreaElement) => Promise<void>;
    handleEditorBlur: (textarea: HTMLTextAreaElement) => void;
  };
  onPreviewKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  debouncedPreviewBody: string;
  editorPlaceholder?: string;
  commentLines?: Set<number>;
  activeCommentLine?: number | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-reading editor-text-zoom-root" style={textZoomStyle}>
      {!compact && !readingFocusActive ? (
        <>
          <div className="ui-pane-header shrink-0">
            <span className="ui-label truncate">Preview</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <EditorUndoRedoButtons canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
              <EditorFocusToggle className="h-7 px-2" />
              {textZoomControl}
              <span className="hidden text-ui-2xs text-muted-foreground sm:inline">{statusText}</span>
              {modeToggle}
            </div>
          </div>
          {renderedEditable ? (
            <MarkdownToolbar
              {...toolbarProps}
              renderedMode={true}
              onFormat={(action) => applyFormat(action, "preview")}
              onInsertInlineNote={() => insertInlineNote("preview")}
              onInsertHighlight={(color) => insertTextHighlight(color, "preview")}
              onInsertSnippet={(snippet) => insertSnippet(snippet, "preview")}
            />
          ) : null}
        </>
      ) : null}
      <div
        ref={bindOutlineScroll}
        className={cn(
          "markdown-preview-edit min-h-0 flex-1 overflow-auto px-6 py-5",
          compact && "markdown-pane",
          compact && readingFocusActive && "reading-focus-pane",
        )}
      >
        {renderedEditable ? (
          <ReadingFocusDocumentLayout
            title={
              previewMeta.title ? (
                <ReadingFocusTitleLink
                  title={previewMeta.title}
                  contextPath={focusTitleContextPath}
                  onNavigate={onNavigate}
                />
              ) : null
            }
          >
            <RenderedMarkdownField
              inputRef={previewRef}
              editorRef={previewBlockRef}
              value={previewBody}
              approvedBaseline={approvedPreviewBody}
              loadedContent={loadedPreviewBody}
              highlightPending={showInlinePendingHighlights}
              figureLabelIndex={figureLabelIndex}
              pendingApproval={
                showInlinePendingHighlights
                  ? {
                      pendingSource: approvalDisplay.pendingSource ?? "human",
                      editedBy: approvalDisplay.editedBy,
                      aiAssisted: approvalDisplay.aiAssisted,
                      aiProvider: approvalDisplay.aiProvider,
                      loadedContent: loadedPreviewBody,
                      onApprove: () => void handleApproveDraft(),
                      onDiscard: () => void handleDiscardDraft(),
                      approving: saveState === "saving",
                      approveLabel: approvalLabel.replace(/^Approve /, ""),
                    }
                  : null
              }
              compact={compact}
              showPreview
              ariaLabel={`Edit ${paneLabel ?? "document"} ${filePath}`}
              placeholder={editorPlaceholder}
              linkContextPath={linkContextPath}
              linksClickable={Boolean(onNavigate)}
              onNavigate={onNavigate}
              refreshVersion={refreshVersion}
              activeOutlineNavPath={activeOutlineNavPath}
              onChange={handlePreviewBodyChange}
              onSelect={updateSelectedLine}
              onTextareaSync={(textarea) => void assetAutocomplete.sync(textarea)}
              onBlur={(event) => assetAutocomplete.handleEditorBlur(event.currentTarget)}
              onKeyDown={onPreviewKeyDown}
              commentLines={commentLines}
              activeCommentLine={activeCommentLine}
            />
          </ReadingFocusDocumentLayout>
        ) : (
          <ReadingFocusDocumentLayout
            title={
              previewMeta.title ? (
                <ReadingFocusTitleLink
                  title={previewMeta.title}
                  contextPath={focusTitleContextPath}
                  onNavigate={onNavigate}
                  className="mb-0"
                />
              ) : null
            }
          >
            {debouncedPreviewBody.trim() ? (
              <MarkdownViewer
                markdown={debouncedPreviewBody}
                linkContextPath={linkContextPath}
                linksClickable={Boolean(onNavigate)}
                onNavigate={onNavigate}
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">{editorPlaceholder}</p>
            )}
          </ReadingFocusDocumentLayout>
        )}
      </div>
    </div>
  );
}
