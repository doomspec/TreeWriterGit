import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { editableHtmlToMarkdown, markdownToEditableHtml } from "@/lib/markdownRoundtrip";
import { continueListOnEnter, isSelectionInListItem } from "@/lib/listAutocomplete";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";
import { cn } from "@/lib/utils";

const EMIT_DEBOUNCE_MS = 200;

function saveSelection(container: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  return range.cloneRange();
}

function restoreSelection(container: HTMLElement, range: Range | null): void {
  if (!range) return;
  const selection = window.getSelection();
  if (!selection) return;
  if (!container.isConnected) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

function textOffsetBeforeSelection(container: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function setDomCursorAtTextOffset(container: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let textNode = walker.nextNode() as Text | null;
  while (textNode) {
    const length = textNode.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    textNode = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** @deprecated Superseded by BlockMarkdownEditor — kept for reference. */
export function EditableMarkdownField({
  value,
  onChange,
  onSelect,
  onBlur,
  onKeyDown,
  onTextareaSync,
  className,
  placeholder = "Write here…",
  ariaLabel,
  linkContextPath = "",
  linksClickable = false,
  onNavigate,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: () => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  onTextareaSync?: (textarea: HTMLTextAreaElement) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  linkContextPath?: string;
  linksClickable?: boolean;
  onNavigate?: (target: NavigateTarget) => void;
  /** Hidden textarea mirror for asset autocomplete and selection tracking. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const localMirrorRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = inputRef ?? localMirrorRef;
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const editingRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const [focused, setFocused] = useState(false);

  const html = useMemo(() => markdownToEditableHtml(value), [value]);

  const syncMirror = useCallback(
    (markdown = value) => {
      const mirror = mirrorRef.current;
      if (!mirror) return;
      mirror.value = markdown;
      onTextareaSync?.(mirror);
      onSelect?.();
    },
    [mirrorRef, onSelect, onTextareaSync, value],
  );

  const flushToParent = useCallback(
    (markdown: string) => {
      if (markdown === lastEmittedRef.current) return;
      lastEmittedRef.current = markdown;
      onChange(markdown);
      syncMirror(markdown);
    },
    [onChange, syncMirror],
  );

  const readMarkdownFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return value;
    return editableHtmlToMarkdown(editor.innerHTML);
  }, [value]);

  const emitChange = useCallback(
    (immediate = false) => {
      const next = readMarkdownFromEditor();

      if (immediate) {
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        flushToParent(next);
        return;
      }

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        flushToParent(readMarkdownFromEditor());
      }, EMIT_DEBOUNCE_MS);
    },
    [flushToParent, readMarkdownFromEditor],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || editingRef.current) return;

    const isExternalChange = value !== lastEmittedRef.current;
    const needsHydration = !editor.innerHTML && html;

    if (!isExternalChange && !needsHydration) return;

    const saved = saveSelection(editor);
    editor.innerHTML = html;
    lastEmittedRef.current = value;
    restoreSelection(editor, saved);
  }, [html, value]);

  const handleFocus = useCallback(() => {
    editingRef.current = true;
    setFocused(true);
    syncMirror(readMarkdownFromEditor());
  }, [readMarkdownFromEditor, syncMirror]);

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      emitChange(true);
      editingRef.current = false;
      setFocused(false);
      onBlur?.(event as unknown as React.FocusEvent<HTMLTextAreaElement>);
    },
    [emitChange, onBlur],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!linksClickable || !onNavigate) return;
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http://") || href.startsWith("https://")) return;
      if (!event.metaKey && !event.ctrlKey) return;
      const target = resolveNavigateTarget(linkContextPath, href);
      if (!target) return;
      event.preventDefault();
      onNavigate(target);
    },
    [linkContextPath, linksClickable, onNavigate],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      if (
        editor &&
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.defaultPrevented
      ) {
        if (!isSelectionInListItem(editor)) {
          const markdown = readMarkdownFromEditor();
          const textOffset = textOffsetBeforeSelection(editor);
          if (textOffset !== null) {
            const result = continueListOnEnter(markdown, textOffset, textOffset);
            if (result) {
              event.preventDefault();
              editingRef.current = true;
              editor.innerHTML = markdownToEditableHtml(result.value);
              lastEmittedRef.current = result.value;
              flushToParent(result.value);
              setDomCursorAtTextOffset(editor, result.selectionStart);
              return;
            }
          }
        }
      }

      onKeyDown?.(event);
    },
    [flushToParent, onKeyDown, readMarkdownFromEditor],
  );

  const showPlaceholder = !value.trim() && !focused;

  return (
    <div className={cn("editable-markdown-field relative w-full", className)}>
      <textarea
        ref={mirrorRef}
        value={value}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="editable-markdown-field__mirror"
      />
      {showPlaceholder ? (
        <p className="pointer-events-none absolute inset-x-0 top-0 text-sm italic text-muted-foreground">
          {placeholder}
        </p>
      ) : null}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        spellCheck
        className={cn(
          "markdown-body markdown-reading min-h-[8rem] w-full outline-none focus-visible:ring-0",
          "editable-markdown-field__surface",
        )}
        onInput={() => emitChange(false)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={() => syncMirror(readMarkdownFromEditor())}
        onClick={handleClick}
        onFocus={handleFocus}
      />
    </div>
  );
}
