import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";

import { markdownToEditableHtml, editableHtmlToMarkdown, renderBlockDisplayHtml } from "@/lib/markdownRoundtrip";
import { hasTextHighlightMacros } from "@/lib/textHighlight";
import {
  joinMarkdownBlocks,
  reconcileBlocks,
  splitMarkdownIntoBlocks,
  type MarkdownBlock,
} from "@/lib/markdownBlocks";
import { continueListOnEnter } from "@/lib/listAutocomplete";
import {
  alignBaselineBlocksToCurrent,
  applyPendingMarksToMarkdown,
  effectivePendingHighlightBaseline,
} from "@/lib/pendingHighlightMarkdown";
import { PendingApprovalChip } from "@/components/editor/PendingApprovalChip";
import type { DraftPendingSource } from "@/lib/draftApproval";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";
import { cn } from "@/lib/utils";

const EMIT_DEBOUNCE_MS = 200;

function tryNavigateFromLink(
  event: React.MouseEvent,
  linksClickable: boolean,
  linkContextPath: string,
  onNavigate?: (target: NavigateTarget) => void,
): boolean {
  if (!linksClickable || !onNavigate) return false;
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("http://") || href.startsWith("https://")) return false;
  event.preventDefault();
  event.stopPropagation();
  const target = resolveNavigateTarget(linkContextPath, href);
  if (!target) return false;
  onNavigate(target);
  return true;
}

function renderBlockHtml(markdown: string): string {
  return renderBlockDisplayHtml(markdown);
}

function readMarkdownFromBlockElement(element: HTMLElement, richEdit: boolean): string {
  if (richEdit || element.querySelector(".text-highlight-badge")) {
    return editableHtmlToMarkdown(element.innerHTML);
  }
  return element.innerText.replace(/\u200b/gi, "").trimEnd();
}

function textOffsetFromPoint(container: HTMLElement, x: number, y: number): number {
  const doc = document;
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (range && container.contains(range.startContainer)) {
      const preRange = range.cloneRange();
      preRange.selectNodeContents(container);
      preRange.setEnd(range.startContainer, range.startOffset);
      return preRange.toString().length;
    }
  }
  return 0;
}

function setTextCursorAtOffset(element: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
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
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectionOffsets(element: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) return null;

  const startRange = range.cloneRange();
  startRange.selectNodeContents(element);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = range.cloneRange();
  endRange.selectNodeContents(element);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
}

export type BlockMarkdownEditorHandle = {
  /** Apply a format transform to the active editing block selection. */
  applyToActiveBlock: (
    transform: (value: string, start: number, end: number) => {
      value: string;
      selectionStart: number;
      selectionEnd: number;
    },
  ) => boolean;
  isBlockEditing: () => boolean;
};

/** MarkTwo-style block editor — rendered blocks toggle to raw markdown on focus. */
export const BlockMarkdownEditor = forwardRef<
  BlockMarkdownEditorHandle,
  {
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
    inputRef?: React.RefObject<HTMLTextAreaElement | null>;
    approvedBaseline?: string;
    loadedContent?: string;
    highlightPending?: boolean;
    pendingApproval?: {
      pendingSource: DraftPendingSource | null;
      editedBy?: string | null;
      aiAssisted?: boolean;
      aiProvider?: string | null;
      loadedContent: string;
      onApprove: () => void;
      onDiscard: () => void;
      approving?: boolean;
      approveLabel?: string;
    } | null;
  }
>(function BlockMarkdownEditor(
  {
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
    approvedBaseline = "",
    loadedContent = "",
    highlightPending = false,
    pendingApproval = null,
  },
  ref,
) {
  const localMirrorRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = inputRef ?? localMirrorRef;
  const lastEmittedRef = useRef(value);
  const debounceTimerRef = useRef<number | null>(null);
  const activeEditRef = useRef<HTMLDivElement | null>(null);
  const pendingCursorRef = useRef<{ blockId: string; offset: number } | null>(null);
  const richEditBlockIdRef = useRef<string | null>(null);
  const blocksRef = useRef<MarkdownBlock[]>([]);

  const [blocks, setBlocks] = useState<MarkdownBlock[]>(() => splitMarkdownIntoBlocks(value));
  blocksRef.current = blocks;
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [remotePending, setRemotePending] = useState(false);

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
    (markdown: string, immediate = false) => {
      const emit = () => {
        if (markdown === lastEmittedRef.current) return;
        lastEmittedRef.current = markdown;
        onChange(markdown);
        syncMirror(markdown);
      };

      if (immediate) {
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        emit();
        return;
      }

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        emit();
      }, EMIT_DEBOUNCE_MS);
    },
    [onChange, syncMirror],
  );

  const commitBlocks = useCallback(
    (nextBlocks: MarkdownBlock[], immediate = false) => {
      setBlocks(nextBlocks);
      flushToParent(joinMarkdownBlocks(nextBlocks), immediate);
    },
    [flushToParent],
  );

  const updateBlockFromElement = useCallback(
    (blockId: string, element: HTMLElement, immediate = false) => {
      const markdown = readMarkdownFromBlockElement(
        element,
        richEditBlockIdRef.current === blockId,
      );
      setBlocks((prev) => {
        const next = prev.map((block) =>
          block.id === blockId ? { ...block, markdown } : block,
        );
        flushToParent(joinMarkdownBlocks(next), immediate);
        return next;
      });
    },
    [flushToParent],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (editingBlockId !== null) {
      if (value !== lastEmittedRef.current) {
        setRemotePending(true);
      }
      return;
    }

    if (value === lastEmittedRef.current) return;
    setBlocks((prev) => reconcileBlocks(prev, value));
    lastEmittedRef.current = value;
    syncMirror(value);
    setRemotePending(false);
  }, [editingBlockId, syncMirror, value]);

  useLayoutEffect(() => {
    if (!editingBlockId || !activeEditRef.current) return;
    const block = blocksRef.current.find((item) => item.id === editingBlockId);
    if (!block) return;

    const element = activeEditRef.current;
    const markdown = block.markdown || "";
    if (hasTextHighlightMacros(markdown)) {
      element.innerHTML = markdownToEditableHtml(markdown) || "\u200b";
      richEditBlockIdRef.current = editingBlockId;
    } else {
      element.textContent = markdown || "\u200b";
      richEditBlockIdRef.current = null;
    }
    element.focus();

    const pending = pendingCursorRef.current;
    if (pending && pending.blockId === editingBlockId) {
      setTextCursorAtOffset(element, pending.offset);
    } else {
      setTextCursorAtOffset(element, element.textContent?.length ?? 0);
    }
    pendingCursorRef.current = null;
  }, [editingBlockId]);

  const enterEditMode = useCallback(
    (blockId: string, event: React.MouseEvent<HTMLElement>) => {
      if (editingBlockId === blockId) return;

      if (editingBlockId && activeEditRef.current) {
        updateBlockFromElement(editingBlockId, activeEditRef.current, true);
      }

      const target = event.currentTarget;
      pendingCursorRef.current = {
        blockId,
        offset: textOffsetFromPoint(target, event.clientX, event.clientY),
      };
      setEditingBlockId(blockId);
    },
    [editingBlockId, updateBlockFromElement],
  );

  const exitEditMode = useCallback(
    (blockId: string, element: HTMLElement) => {
      updateBlockFromElement(blockId, element, true);
      richEditBlockIdRef.current = null;
      setEditingBlockId(null);
      activeEditRef.current = null;
    },
    [updateBlockFromElement],
  );

  const handleBlockInput = useCallback(
    (blockId: string, element: HTMLElement) => {
      const markdown = readMarkdownFromBlockElement(
        element,
        richEditBlockIdRef.current === blockId,
      );
      setBlocks((prev) => {
        const next = prev.map((block) =>
          block.id === blockId ? { ...block, markdown } : block,
        );
        flushToParent(joinMarkdownBlocks(next), false);
        return next;
      });
    },
    [flushToParent],
  );

  const handleBlockKeyDown = useCallback(
    (blockId: string, event: React.KeyboardEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.defaultPrevented
      ) {
        const markdown = element.innerText.replace(/\u200b/gi, "");
        const textOffset = selectionOffsets(element)?.start ?? null;
        if (textOffset !== null) {
          const result = continueListOnEnter(markdown, textOffset, textOffset);
          if (result) {
            event.preventDefault();
            element.textContent = result.value;
            const nextBlocks = blocks.map((block) =>
              block.id === blockId ? { ...block, markdown: result.value } : block,
            );
            commitBlocks(nextBlocks, true);
            setTextCursorAtOffset(element, result.selectionStart);
            return;
          }
        }
      }

      onKeyDown?.(event);
    },
    [blocks, commitBlocks, onKeyDown],
  );

  const handleRenderedClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      tryNavigateFromLink(event, linksClickable, linkContextPath, onNavigate);
    },
    [linkContextPath, linksClickable, onNavigate],
  );

  const applyRemoteReload = useCallback(() => {
    setBlocks(reconcileBlocks(blocks, value, true));
    lastEmittedRef.current = value;
    setEditingBlockId(null);
    setRemotePending(false);
    syncMirror(value);
  }, [blocks, syncMirror, value]);

  useImperativeHandle(
    ref,
    () => ({
      applyToActiveBlock(transform) {
        if (!editingBlockId || !activeEditRef.current) return false;
        const element = activeEditRef.current;
        const richEdit = richEditBlockIdRef.current === editingBlockId;
        const markdown = readMarkdownFromBlockElement(element, richEdit);
        const offsets = selectionOffsets(element);
        const start = offsets?.start ?? markdown.length;
        const end = offsets?.end ?? start;
        const result = transform(markdown, start, end);
        const nextBlocks = blocks.map((block) =>
          block.id === editingBlockId ? { ...block, markdown: result.value } : block,
        );
        commitBlocks(nextBlocks, true);

        if (hasTextHighlightMacros(result.value)) {
          richEditBlockIdRef.current = null;
          setEditingBlockId(null);
          activeEditRef.current = null;
          return true;
        }

        if (richEdit) {
          element.innerHTML = markdownToEditableHtml(result.value) || "\u200b";
          richEditBlockIdRef.current = editingBlockId;
        } else {
          element.textContent = result.value;
        }
        setTextCursorAtOffset(element, result.selectionStart);
        return true;
      },
      isBlockEditing() {
        return editingBlockId !== null;
      },
    }),
    [blocks, commitBlocks, editingBlockId],
  );

  const showPlaceholder = !value.trim() && editingBlockId === null && blocks.length === 0;

  const startEmptyBlock = useCallback(() => {
    const newBlock: MarkdownBlock = { id: `blk-${Date.now()}`, markdown: "" };
    setBlocks([newBlock]);
    pendingCursorRef.current = { blockId: newBlock.id, offset: 0 };
    setEditingBlockId(newBlock.id);
  }, []);

  const blockHtmlById = useMemo(() => {
    const map = new Map<string, string>();
    if (!highlightPending) {
      for (const block of blocks) {
        map.set(block.id, renderBlockHtml(block.markdown));
      }
      return map;
    }
    const effectiveBaseline = effectivePendingHighlightBaseline(approvedBaseline, loadedContent);
    const aligned = alignBaselineBlocksToCurrent(effectiveBaseline, blocks);
    for (const block of blocks) {
      const baselineBlock = aligned.get(block.id) ?? "";
      const highlighted =
        applyPendingMarksToMarkdown(baselineBlock, block.markdown) ?? block.markdown;
      map.set(block.id, renderBlockHtml(highlighted));
    }
    return map;
  }, [approvedBaseline, blocks, highlightPending, loadedContent]);

  const changedBlockIds = useMemo(() => {
    if (!highlightPending || !pendingApproval) return new Set<string>();
    const effectiveBaseline = effectivePendingHighlightBaseline(approvedBaseline, loadedContent);
    const aligned = alignBaselineBlocksToCurrent(effectiveBaseline, blocks);
    const ids = new Set<string>();
    for (const block of blocks) {
      const baselineBlock = aligned.get(block.id) ?? "";
      if (baselineBlock !== block.markdown) ids.add(block.id);
    }
    return ids;
  }, [approvedBaseline, blocks, highlightPending, loadedContent, pendingApproval]);

  const reviewMode = highlightPending && Boolean(pendingApproval);

  const renderApprovalChip = (blockId: string) =>
    changedBlockIds.has(blockId) && pendingApproval ? (
      <PendingApprovalChip
        inline
        className="mb-1.5"
        pendingSource={pendingApproval.pendingSource}
        editedBy={pendingApproval.editedBy}
        aiAssisted={pendingApproval.aiAssisted}
        aiProvider={pendingApproval.aiProvider}
        approvedBaseline={approvedBaseline}
        loadedContent={pendingApproval.loadedContent}
        current={value}
        onApprove={pendingApproval.onApprove}
        onDiscard={pendingApproval.onDiscard}
        approving={pendingApproval.approving}
        approveLabel={pendingApproval.approveLabel}
      />
    ) : null;

  return (
    <div className={cn("block-markdown-editor relative w-full", reviewMode && "block-markdown-editor--review", className)}>
      <textarea
        ref={mirrorRef}
        value={value}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="editable-markdown-field__mirror"
      />

      {remotePending ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          <span>Remote changes available — reload or keep editing.</span>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded px-2 py-1 hover:bg-amber-500/20"
              onClick={() => setRemotePending(false)}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="rounded bg-primary px-2 py-1 text-primary-foreground"
              onClick={applyRemoteReload}
            >
              Reload
            </button>
          </div>
        </div>
      ) : null}

      {showPlaceholder ? (
        <button
          type="button"
          className="block w-full text-left text-sm italic text-muted-foreground"
          onClick={startEmptyBlock}
        >
          {placeholder}
        </button>
      ) : null}

      <div
        className="markdown-body markdown-reading block-markdown-editor__surface min-h-[8rem] w-full"
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        onClick={handleRenderedClick}
      >
        {blocks.map((block) =>
          editingBlockId === block.id ? (
            <div key={block.id} className="block-markdown-editor__block">
              {renderApprovalChip(block.id)}
              <div
                ref={(node) => {
                  activeEditRef.current = node;
                }}
                contentEditable
                suppressContentEditableWarning
                spellCheck
                className="block-markdown-editor__block block-markdown-editor__block--editing"
                onInput={(event) => handleBlockInput(block.id, event.currentTarget)}
                onBlur={(event) => {
                  exitEditMode(block.id, event.currentTarget);
                  onBlur?.(event as unknown as React.FocusEvent<HTMLTextAreaElement>);
                }}
                onKeyDown={(event) => handleBlockKeyDown(block.id, event)}
              />
            </div>
          ) : (
            <div
              key={block.id}
              className={cn(
                "block-markdown-editor__block cursor-text",
                reviewMode && changedBlockIds.has(block.id) && "block-markdown-editor__block--review",
              )}
            >
              {renderApprovalChip(block.id)}
              <div
                className="block-markdown-editor__block-surface"
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  if (tryNavigateFromLink(event, linksClickable, linkContextPath, onNavigate)) return;
                  event.preventDefault();
                  enterEditMode(block.id, event);
                }}
                dangerouslySetInnerHTML={{
                  __html: blockHtmlById.get(block.id) ?? "",
                }}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
});
