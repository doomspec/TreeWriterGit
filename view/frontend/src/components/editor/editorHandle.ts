import type { MarkdownFormatAction } from "@/lib/markdownFormat";

/** A markdown-string transform: given the current value and a selection, return the edited value + new selection. */
export type FormatTransform = (
  value: string,
  start: number,
  end: number,
) => {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

/** Imperative handle exposed by the rendered markdown editing surface (ProseMirrorMarkdownField). */
export type BlockMarkdownEditorHandle = {
  /** Apply a format transform to the active block selection. */
  applyToActiveBlock: (transform: FormatTransform) => boolean;
  /** Apply a format transform to the current rendered-block selection. */
  applyToRenderedSelection: (transform: FormatTransform) => boolean;
  isBlockEditing: () => boolean;
  /** 1-based line number of the caret within the editor value. */
  getCursorLineNumber: () => number | null;
  /** Insert asset markdown at the last cursor position, or append a new block. */
  insertSnippet: (snippet: string) => boolean;
  /** Native ProseMirror command path. Returns true when handled. */
  runFormat?: (action: MarkdownFormatAction) => boolean;
  runHighlight?: (color: string) => boolean;
  runInlineNote?: () => boolean;
  /** Native editor-engine history. */
  runUndo?: () => boolean;
  runRedo?: () => boolean;
  canUndo?: () => boolean;
  canRedo?: () => boolean;
};
