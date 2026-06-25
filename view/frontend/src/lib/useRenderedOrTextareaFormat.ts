import { useCallback, type RefObject } from "react";

import type { BlockMarkdownEditorHandle } from "@/components/editor/BlockMarkdownEditor";
import { applyMarkdownFormat, type MarkdownFormatAction } from "@/lib/markdownFormat";
import { authorNoteMacro, wrapInlineNote } from "@/lib/inlineNotes";
import { applyTextHighlight, type TextHighlightColorId } from "@/lib/textHighlight";
import { getUserName } from "@/lib/userIdentity";

type SelectionEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export function applyWithBlockEditorFirst(
  blockRef: BlockMarkdownEditorHandle | null,
  renderedActive: boolean,
  transform: (value: string, start: number, end: number) => SelectionEdit,
  textareaApply: () => void,
): void {
  if (renderedActive && blockRef) {
    if (blockRef.applyToRenderedSelection(transform)) return;
    if (blockRef.applyToActiveBlock(transform)) return;
    return;
  }
  textareaApply();
}

export function useRenderedOrTextareaFormat({
  blockRef,
  textareaRef,
  renderedActive,
  onTextareaEdit,
}: {
  blockRef: RefObject<BlockMarkdownEditorHandle | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  renderedActive: boolean;
  onTextareaEdit: (value: string, selectionStart: number, selectionEnd?: number) => void;
}) {
  const applyFormat = useCallback(
    (action: MarkdownFormatAction) => {
      applyWithBlockEditorFirst(
        blockRef.current,
        renderedActive,
        (value, start, end) => applyMarkdownFormat(value, start, end, action),
        () => {
          const target = textareaRef.current;
          if (!target) return;
          const result = applyMarkdownFormat(
            target.value,
            target.selectionStart,
            target.selectionEnd,
            action,
          );
          onTextareaEdit(result.value, result.selectionStart, result.selectionEnd);
        },
      );
    },
    [blockRef, onTextareaEdit, renderedActive, textareaRef],
  );

  const insertInlineNote = useCallback(() => {
    const target = textareaRef.current;
    if (!target) return;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const selected = target.value.slice(start, end);
    const note = wrapInlineNote(authorNoteMacro(getUserName()), selected);
    onTextareaEdit(`${target.value.slice(0, start)}${note}${target.value.slice(end)}`, start + note.length);
  }, [onTextareaEdit, textareaRef]);

  const insertTextHighlight = useCallback(
    (colorId: TextHighlightColorId) => {
      applyWithBlockEditorFirst(
        blockRef.current,
        renderedActive,
        (value, start, end) => applyTextHighlight(value, start, end, colorId),
        () => {
          const target = textareaRef.current;
          if (!target) return;
          const result = applyTextHighlight(
            target.value,
            target.selectionStart,
            target.selectionEnd,
            colorId,
          );
          onTextareaEdit(result.value, result.selectionStart, result.selectionEnd);
        },
      );
    },
    [blockRef, onTextareaEdit, renderedActive, textareaRef],
  );

  const insertSnippet = useCallback(
    (snippet: string) => {
      if (renderedActive && blockRef.current?.insertSnippet(snippet)) {
        return;
      }
      const target = textareaRef.current;
      if (!target) return;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      onTextareaEdit(`${target.value.slice(0, start)}${snippet}${target.value.slice(end)}`, start + snippet.length);
    },
    [blockRef, onTextareaEdit, renderedActive, textareaRef],
  );

  return { applyFormat, insertInlineNote, insertTextHighlight, insertSnippet };
}
