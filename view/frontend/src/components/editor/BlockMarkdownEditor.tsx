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

import { editableHtmlToMarkdown, renderBlockDisplayHtml } from "@/lib/markdownRoundtrip";
import type { FigureMetadata } from "@/lib/figures";
import { computeScopedRefFigurePlacementsByBlockIndex, resolveFigureByRefKey } from "@/lib/figureLabelIndex";
import { hasTextHighlightMacros, stripTextHighlightMacrosForDiff } from "@/lib/textHighlight";
import { resolveMarkdownSelectionRange } from "@/lib/markdownVisibleSelection";
import { EquationCard } from "@/components/editor/EquationCard";
import { FigureCard } from "@/components/editor/FigureCard";
import {
  listDeferredFigurePaths,
  listInlineFigureEmbedPaths,
  parseEmbedBlock,
  replaceInlineFigureEmbedsWithRefs,
} from "@/lib/embedBlocks";
import { buildMarkdownVisibleOffsetMap } from "@/lib/markdownVisibleSelection";
import {
  globalLineFromBlockPosition,
  joinMarkdownBlocks,
  reconcileBlocks,
  splitMarkdownIntoBlocks,
  type MarkdownBlock,
} from "@/lib/markdownBlocks";
import { buildBlockHeadingIdMap } from "@/lib/markdownOutline";
import { applyOutlineNavLinkHighlight } from "@/lib/outlineNavHighlight";
import { isLinkedHeadingLine } from "@/lib/composedDraftStructure";
import { continueListOnEnter, isSelectionInListItem } from "@/lib/listAutocomplete";
import {
  alignBaselineBlocksToCurrent,
  applyPendingMarksToMarkdown,
  effectivePendingHighlightBaseline,
} from "@/lib/pendingHighlightMarkdown";
import { PendingApprovalChip } from "@/components/editor/PendingApprovalChip";
import { BlockUnitInsertButton } from "@/components/editor/BlockUnitInsertButton";
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

  if (href.startsWith("figure://")) {
    event.preventDefault();
    event.stopPropagation();
    onNavigate({ type: "folder", path: href.slice("figure://".length) });
    return true;
  }

  if (href.startsWith("equation://")) {
    event.preventDefault();
    event.stopPropagation();
    onNavigate({ type: "folder", path: href.slice("equation://".length) });
    return true;
  }

  const target = resolveNavigateTarget(linkContextPath, href);
  if (!target) return false;
  event.preventDefault();
  event.stopPropagation();
  onNavigate(target);
  return true;
}

function renderBlockHtml(markdown: string): string {
  return renderBlockDisplayHtml(markdown);
}

function readMarkdownFromBlockElement(element: HTMLElement): string {
  return editableHtmlToMarkdown(element.innerHTML);
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

function textOffsetFromPoint(container: HTMLElement, x: number, y: number): number | null {
  const doc = container.ownerDocument;
  let range: Range | null = null;
  if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(x, y);
  } else {
    const caretPositionFromPoint = (
      doc as Document & {
        caretPositionFromPoint?: (
          clientX: number,
          clientY: number,
        ) => { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint;
    const position = caretPositionFromPoint?.(x, y);
    if (position) {
      range = doc.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }
  if (!range || !container.contains(range.startContainer)) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function domCaretToMarkdownOffset(element: HTMLElement, markdown: string): number {
  const domOffset = textOffsetBeforeSelection(element);
  if (domOffset === null) return markdown.length;
  const map = buildMarkdownVisibleOffsetMap(markdown);
  if (map.startToMarkdown.length === 0) return 0;
  const idx = Math.min(Math.max(0, domOffset), map.startToMarkdown.length - 1);
  return map.startToMarkdown[idx] ?? 0;
}

function blockMarkdownForRender(markdown: string): string {
  if (!parseEmbedBlock(markdown) && listInlineFigureEmbedPaths(markdown).length > 0) {
    return replaceInlineFigureEmbedsWithRefs(markdown).markdown;
  }
  return markdown;
}

function blockHydrationKey(markdown: string, html: string): string {
  return `${markdown}\0${html}`;
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

function findBlockIdForSelection(surface: HTMLElement): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const node = selection.anchorNode;
  const anchor = node instanceof Element ? node : node?.parentElement;
  const block = anchor?.closest("[data-block-id]") as HTMLElement | null;
  if (!block || !surface.contains(block)) return null;
  return block.getAttribute("data-block-id");
}

type FormatTransform = (
  value: string,
  start: number,
  end: number,
) => {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

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
};

/** Block editor — always-on WYSIWYG contenteditable blocks (no raw-markdown toggle). */
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
    refreshVersion?: number;
    inputRef?: React.RefObject<HTMLTextAreaElement | null>;
    approvedBaseline?: string;
    loadedContent?: string;
    highlightPending?: boolean;
    /** When set, \\ref{fig:…} badges link to matching paper figures. */
    figureLabelIndex?: Map<string, FigureMetadata>;
    /** Highlight section/subsection links matching the current workspace path. */
    activeOutlineNavPath?: string | null;
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
    /** Show add unit/subsection control on the focused paragraph block. */
    composedDraftActions?: {
      onAddUnitAfter: (blockId: string, blockIndex: number) => void;
      onAddSubsectionAfter: (blockId: string, blockIndex: number) => void;
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
    refreshVersion = 0,
    inputRef,
    approvedBaseline = "",
    loadedContent = "",
    highlightPending = false,
    figureLabelIndex,
    activeOutlineNavPath = null,
    pendingApproval = null,
    composedDraftActions = null,
  },
  ref,
) {
  const localMirrorRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = inputRef ?? localMirrorRef;
  const lastEmittedRef = useRef(value);
  const debounceTimerRef = useRef<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const focusedBlockIdRef = useRef<string | null>(null);
  const editedDuringFocusRef = useRef(false);
  const lastInsertBlockIdRef = useRef<string | null>(null);
  const lastInsertRangeRef = useRef<{ start: number; end: number } | null>(null);
  const hydratedMarkdownRef = useRef(new Map<string, string>());
  const pendingFocusCursorRef = useRef<{ blockId: string; offset: number | null } | null>(null);
  const blocksRef = useRef<MarkdownBlock[]>([]);

  const [blocks, setBlocks] = useState<MarkdownBlock[]>(() => splitMarkdownIntoBlocks(value));
  blocksRef.current = blocks;
  const blockHeadingIds = useMemo(() => buildBlockHeadingIdMap(blocks), [blocks]);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
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
      if (focusedBlockIdRef.current !== null) {
        editedDuringFocusRef.current = true;
      }
      setBlocks(nextBlocks);
      flushToParent(joinMarkdownBlocks(nextBlocks), immediate);
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
    if (focusedBlockIdRef.current !== null) {
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
  }, [syncMirror, value]);

  const changedBlockIds = useMemo(() => {
    if (!highlightPending || !pendingApproval) return new Set<string>();
    const effectiveBaseline = effectivePendingHighlightBaseline(approvedBaseline, loadedContent);
    const aligned = alignBaselineBlocksToCurrent(effectiveBaseline, blocks);
    const ids = new Set<string>();
    for (const block of blocks) {
      const baselineBlock = aligned.get(block.id) ?? "";
      if (
        stripTextHighlightMacrosForDiff(baselineBlock) !== stripTextHighlightMacrosForDiff(block.markdown)
      ) {
        ids.add(block.id);
      }
    }
    return ids;
  }, [approvedBaseline, blocks, highlightPending, loadedContent, pendingApproval]);

  const reviewMode = highlightPending && Boolean(pendingApproval);

  const refFigurePlacements = useMemo(
    () =>
      figureLabelIndex && figureLabelIndex.size > 0
        ? computeScopedRefFigurePlacementsByBlockIndex(value, figureLabelIndex)
        : new Map<number, FigureMetadata[]>(),
    [figureLabelIndex, value],
  );

  const baselineByBlockId = useMemo(() => {
    if (!reviewMode) return new Map<string, string>();
    const effectiveBaseline = effectivePendingHighlightBaseline(approvedBaseline, loadedContent);
    return alignBaselineBlocksToCurrent(effectiveBaseline, blocks);
  }, [approvedBaseline, blocks, loadedContent, reviewMode]);

  const blockHtmlById = useMemo(() => {
    const map = new Map<string, string>();
    for (const block of blocks) {
      const isFocused = focusedBlockId === block.id;
      let markdownForRender = block.markdown;
      if (!parseEmbedBlock(block.markdown) && listInlineFigureEmbedPaths(block.markdown).length > 0) {
        markdownForRender = replaceInlineFigureEmbedsWithRefs(block.markdown).markdown;
      }
      if (reviewMode && !isFocused && changedBlockIds.has(block.id)) {
        const baselineBlock = baselineByBlockId.get(block.id) ?? "";
        const highlighted =
          applyPendingMarksToMarkdown(baselineBlock, block.markdown) ?? block.markdown;
        let highlightedForRender = highlighted;
        if (!parseEmbedBlock(highlighted) && listInlineFigureEmbedPaths(highlighted).length > 0) {
          highlightedForRender = replaceInlineFigureEmbedsWithRefs(highlighted).markdown;
        }
        map.set(block.id, renderBlockHtml(highlightedForRender));
      } else {
        map.set(block.id, renderBlockHtml(markdownForRender));
      }
    }
    return map;
  }, [baselineByBlockId, blocks, changedBlockIds, focusedBlockId, reviewMode]);

  useLayoutEffect(() => {
    blockRefs.current.forEach((element) => {
      applyOutlineNavLinkHighlight(element, linkContextPath, activeOutlineNavPath);
    });
  }, [activeOutlineNavPath, blockHtmlById, linkContextPath]);

  const hydrateBlock = useCallback(
    (blockId: string, html: string, markdownKey: string) => {
      const element = blockRefs.current.get(blockId);
      if (!element) return;
      if (hydratedMarkdownRef.current.get(blockId) !== markdownKey) {
        element.innerHTML = html || "\u200b";
        hydratedMarkdownRef.current.set(blockId, markdownKey);
      }
      applyOutlineNavLinkHighlight(element, linkContextPath, activeOutlineNavPath);
    },
    [activeOutlineNavPath, linkContextPath],
  );

  useLayoutEffect(() => {
    for (const block of blocks) {
      const html = blockHtmlById.get(block.id) ?? "";
      const markdownKey = blockHydrationKey(block.markdown, html);
      if (focusedBlockIdRef.current === block.id) continue;
      hydrateBlock(block.id, html, markdownKey);
    }
  }, [blockHtmlById, blocks, hydrateBlock]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !figureLabelIndex) return;
    for (const badge of surface.querySelectorAll<HTMLElement>("[data-latex-ref]")) {
      const refKey = badge.dataset.latexRef?.trim();
      if (!refKey) continue;
      const figure = resolveFigureByRefKey(refKey, figureLabelIndex);
      if (!figure) {
        badge.classList.remove("latex-ref-badge--linked");
        badge.removeAttribute("data-figure-path");
        badge.removeAttribute("title");
        continue;
      }
      badge.classList.add("latex-ref-badge--linked");
      badge.dataset.figurePath = figure.path;
      badge.title = `Open ${figure.title} — scroll to preview below`;
    }
  }, [blockHtmlById, blocks, figureLabelIndex, value]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !figureLabelIndex || !onNavigate) return;

    const handleClick = (event: MouseEvent) => {
      const badge = (event.target as HTMLElement).closest<HTMLElement>("[data-figure-path]");
      if (!badge || !surface.contains(badge)) return;
      const figurePath = badge.dataset.figurePath?.trim();
      if (!figurePath) return;
      event.preventDefault();
      event.stopPropagation();
      onNavigate({ type: "folder", path: figurePath });
      const preview = document.getElementById(`figure-preview-${figurePath.replace(/\//g, "--")}`);
      preview?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    surface.addEventListener("click", handleClick);
    return () => surface.removeEventListener("click", handleClick);
  }, [figureLabelIndex, onNavigate]);

  const updateBlockFromElement = useCallback(
    (blockId: string, element: HTMLElement, immediate = false) => {
      const markdown = readMarkdownFromBlockElement(element);
      hydratedMarkdownRef.current.set(blockId, markdown);
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

  const rememberInsertPoint = useCallback((blockId: string, element: HTMLElement) => {
    const block = blocksRef.current.find((item) => item.id === blockId);
    if (!block) return;
    const range =
      resolveMarkdownSelectionRange(element, block.markdown) ??
      (() => {
        const offset = domCaretToMarkdownOffset(element, block.markdown);
        return { start: offset, end: offset };
      })();
    lastInsertBlockIdRef.current = blockId;
    lastInsertRangeRef.current = range;
  }, []);

  const insertSnippet = useCallback(
    (snippet: string): boolean => {
      const trimmed = snippet.trim();
      if (!trimmed) return false;

      editedDuringFocusRef.current = true;
      const blockId = focusedBlockIdRef.current ?? lastInsertBlockIdRef.current;
      const blockIndex = blockId
        ? blocksRef.current.findIndex((item) => item.id === blockId)
        : -1;

      if (blockId && blockIndex >= 0) {
        const block = blocksRef.current[blockIndex];
        const range = lastInsertRangeRef.current ?? {
          start: block.markdown.length,
          end: block.markdown.length,
        };
        const isBlockEmbed = /^::(figure|equation)\[/.test(trimmed);

        if (isBlockEmbed && range.start === range.end) {
          const nextBlocks = [...blocksRef.current];
          nextBlocks.splice(blockIndex + 1, 0, {
            id: `blk-${Date.now()}`,
            markdown: trimmed,
          });
          commitBlocks(nextBlocks, true);
          return true;
        }

        const nextMarkdown = `${block.markdown.slice(0, range.start)}${snippet}${block.markdown.slice(range.end)}`;
        commitBlocks(
          blocksRef.current.map((item) =>
            item.id === blockId ? { ...item, markdown: nextMarkdown } : item,
          ),
          true,
        );
        return true;
      }

      commitBlocks(
        [...blocksRef.current, { id: `blk-${Date.now()}`, markdown: trimmed }],
        true,
      );
      return true;
    },
    [commitBlocks],
  );

  const handleBlockInput = useCallback(
    (blockId: string, element: HTMLElement) => {
      editedDuringFocusRef.current = true;
      rememberInsertPoint(blockId, element);
      const markdown = readMarkdownFromBlockElement(element);
      hydratedMarkdownRef.current.set(blockId, markdown);
      setBlocks((prev) => {
        const next = prev.map((block) =>
          block.id === blockId ? { ...block, markdown } : block,
        );
        flushToParent(joinMarkdownBlocks(next), false);
        return next;
      });
    },
    [flushToParent, rememberInsertPoint],
  );

  const handleBlockFocus = useCallback(
    (blockId: string) => {
      editedDuringFocusRef.current = false;
      focusedBlockIdRef.current = blockId;
      setFocusedBlockId(blockId);
      const block = blocksRef.current.find((item) => item.id === blockId);
      const element = blockRefs.current.get(blockId);
      if (block && element) {
        const markdownForRender = blockMarkdownForRender(block.markdown);
        const html = renderBlockHtml(markdownForRender);
        const hydrationKey = blockHydrationKey(block.markdown, html);
        if (hydratedMarkdownRef.current.get(blockId) !== hydrationKey) {
          const pending = pendingFocusCursorRef.current;
          const cursorOffset =
            pending?.blockId === blockId
              ? pending.offset
              : textOffsetBeforeSelection(element);
          pendingFocusCursorRef.current = null;
          element.innerHTML = html || "\u200b";
          hydratedMarkdownRef.current.set(blockId, hydrationKey);
          if (cursorOffset !== null) {
            requestAnimationFrame(() => {
              setTextCursorAtOffset(element, cursorOffset);
            });
          }
        } else {
          pendingFocusCursorRef.current = null;
        }
        applyOutlineNavLinkHighlight(element, linkContextPath, activeOutlineNavPath);
      }
      syncMirror(block?.markdown ?? value);
    },
    [activeOutlineNavPath, linkContextPath, syncMirror, value],
  );

  const handleBlockMouseDown = useCallback(
    (blockId: string, event: React.MouseEvent<HTMLDivElement>) => {
      if (tryNavigateFromLink(event, linksClickable, linkContextPath, onNavigate)) return;
      const element = event.currentTarget;
      if (focusedBlockIdRef.current === blockId) return;
      const offset =
        textOffsetFromPoint(element, event.clientX, event.clientY) ??
        textOffsetBeforeSelection(element);
      pendingFocusCursorRef.current = { blockId, offset };
    },
    [linkContextPath, linksClickable, onNavigate],
  );

  const handleBlockBlur = useCallback(
    (blockId: string, element: HTMLElement) => {
      rememberInsertPoint(blockId, element);
      if (editedDuringFocusRef.current) {
        updateBlockFromElement(blockId, element, true);
      }
      editedDuringFocusRef.current = false;
      focusedBlockIdRef.current = null;
      setFocusedBlockId(null);
      onBlur?.(element as unknown as React.FocusEvent<HTMLTextAreaElement>);
    },
    [onBlur, rememberInsertPoint, updateBlockFromElement],
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
        !event.defaultPrevented &&
        !isSelectionInListItem(element)
      ) {
        const markdown = readMarkdownFromBlockElement(element);
        const textOffset = textOffsetBeforeSelection(element);
        if (textOffset !== null) {
          const result = continueListOnEnter(markdown, textOffset, textOffset);
          if (result) {
            event.preventDefault();
            const html = renderBlockHtml(result.value);
            element.innerHTML = html || "\u200b";
            hydratedMarkdownRef.current.set(blockId, result.value);
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

  const handleBlockClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      tryNavigateFromLink(event, linksClickable, linkContextPath, onNavigate);
    },
    [linkContextPath, linksClickable, onNavigate],
  );

  const applyRemoteReload = useCallback(() => {
    setBlocks(reconcileBlocks(blocks, value, true));
    lastEmittedRef.current = value;
    focusedBlockIdRef.current = null;
    setFocusedBlockId(null);
    hydratedMarkdownRef.current.clear();
    setRemotePending(false);
    syncMirror(value);
  }, [blocks, syncMirror, value]);

  const applyTransformToBlock = useCallback(
    (
      blockId: string,
      markdown: string,
      range: { start: number; end: number },
      transform: FormatTransform,
    ) => {
      const result = transform(markdown, range.start, range.end);
      const nextBlocks = blocks.map((block) =>
        block.id === blockId ? { ...block, markdown: result.value } : block,
      );
      commitBlocks(nextBlocks, true);

      const element = blockRefs.current.get(blockId);
      if (element) {
        element.innerHTML = renderBlockHtml(result.value) || "\u200b";
        hydratedMarkdownRef.current.set(blockId, result.value);
        if (hasTextHighlightMacros(result.value)) {
          setTextCursorAtOffset(element, result.selectionEnd);
        } else {
          setTextCursorAtOffset(element, result.selectionStart);
        }
      }
      return true;
    },
    [blocks, commitBlocks],
  );

  const applySelectionTransform = useCallback(
    (transform: FormatTransform) => {
      const surface = surfaceRef.current;
      if (!surface) return false;

      const blockId = findBlockIdForSelection(surface);
      if (!blockId) return false;

      const block = blocks.find((item) => item.id === blockId);
      if (!block) return false;

      const blockSurface = blockRefs.current.get(blockId);
      if (!blockSurface) return false;

      const range =
        resolveMarkdownSelectionRange(blockSurface, block.markdown) ??
        (() => {
          const offset = domCaretToMarkdownOffset(blockSurface, block.markdown);
          return { start: offset, end: offset };
        })();

      return applyTransformToBlock(blockId, block.markdown, range, transform);
    },
    [applyTransformToBlock, blocks],
  );

  const getCursorLineNumber = useCallback((): number | null => {
    const blockId = focusedBlockIdRef.current ?? lastInsertBlockIdRef.current;
    if (!blockId) return null;
    const block = blocksRef.current.find((item) => item.id === blockId);
    const element = blockRefs.current.get(blockId);
    if (!block || !element) return null;
    const inBlockOffset = domCaretToMarkdownOffset(element, block.markdown);
    return globalLineFromBlockPosition(blocksRef.current, blockId, inBlockOffset);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyToActiveBlock(transform) {
        return applySelectionTransform(transform);
      },
      applyToRenderedSelection(transform) {
        return applySelectionTransform(transform);
      },
      isBlockEditing() {
        return focusedBlockIdRef.current !== null;
      },
      getCursorLineNumber,
      insertSnippet,
    }),
    [applySelectionTransform, getCursorLineNumber, insertSnippet],
  );

  const showPlaceholder = !value.trim() && blocks.length === 0;

  const startEmptyBlock = useCallback(() => {
    const newBlock: MarkdownBlock = { id: `blk-${Date.now()}`, markdown: "" };
    setBlocks([newBlock]);
    requestAnimationFrame(() => {
      const element = blockRefs.current.get(newBlock.id);
      element?.focus();
    });
  }, []);

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
        ref={surfaceRef}
        className="markdown-body markdown-reading block-markdown-editor__surface min-h-[8rem] w-full"
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
      >
        {blocks.map((block, blockIndex) => {
          const embed = parseEmbedBlock(block.markdown);
          if (embed) {
            return (
              <div
                key={block.id}
                data-block-id={block.id}
                data-heading-id={blockHeadingIds[block.id]}
                className={cn(
                  "block-markdown-editor__block block-markdown-editor__embed my-3",
                  reviewMode && changedBlockIds.has(block.id) && "block-markdown-editor__block--review",
                )}
              >
                {renderApprovalChip(block.id)}
                {embed.kind === "figure" ? (
                  <FigureCard
                    targetPath={embed.targetPath}
                    embeddedInEditor
                    linkContextPath={linkContextPath}
                    linksClickable={linksClickable}
                    onNavigate={onNavigate}
                    refreshVersion={refreshVersion}
                  />
                ) : (
                  <EquationCard
                    targetPath={embed.targetPath}
                    embeddedInEditor
                    linkContextPath={linkContextPath}
                    onNavigate={onNavigate}
                    refreshVersion={refreshVersion}
                  />
                )}
              </div>
            );
          }

          const deferredFigurePaths = listDeferredFigurePaths(block.markdown);
          const placedRefFigures = refFigurePlacements.get(blockIndex) ?? [];
          const afterBlockFigurePaths = [
            ...deferredFigurePaths,
            ...placedRefFigures
              .map((item) => item.path)
              .filter((path) => !deferredFigurePaths.includes(path)),
          ];

          return (
          <div
            key={block.id}
            data-block-id={block.id}
            data-heading-id={blockHeadingIds[block.id]}
            className={cn(
              "block-markdown-editor__block",
              focusedBlockId === block.id && "block-markdown-editor__block--focused",
              afterBlockFigurePaths.length > 0 && "block-markdown-editor__block--inline-figures",
              reviewMode && changedBlockIds.has(block.id) && "block-markdown-editor__block--review",
            )}
          >
            {renderApprovalChip(block.id)}
            <div
              ref={(node) => {
                if (node) blockRefs.current.set(block.id, node);
                else blockRefs.current.delete(block.id);
              }}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              className="block-markdown-editor__block-surface outline-none"
              onInput={(event) => handleBlockInput(block.id, event.currentTarget)}
              onMouseDown={(event) => handleBlockMouseDown(block.id, event)}
              onMouseUp={(event) => {
                rememberInsertPoint(block.id, event.currentTarget);
                syncMirror();
              }}
              onFocus={() => handleBlockFocus(block.id)}
              onBlur={(event) => handleBlockBlur(block.id, event.currentTarget)}
              onKeyDown={(event) => handleBlockKeyDown(block.id, event)}
              onKeyUp={() => syncMirror()}
              onClick={handleBlockClick}
            />
            {composedDraftActions &&
            focusedBlockId === block.id &&
            !isLinkedHeadingLine(block.markdown) ? (
              <BlockUnitInsertButton
                onAddUnit={() => composedDraftActions.onAddUnitAfter(block.id, blockIndex)}
                onAddSubsection={() =>
                  composedDraftActions.onAddSubsectionAfter(block.id, blockIndex)
                }
              />
            ) : null}
            {afterBlockFigurePaths.length > 0 ? (
              <div className="block-markdown-editor__deferred-figures">
                {afterBlockFigurePaths.map((targetPath) => (
                  <div
                    key={`${block.id}-${targetPath}`}
                    id={`figure-preview-${targetPath.replace(/\//g, "--")}`}
                  >
                    <FigureCard
                      targetPath={targetPath}
                      embeddedInEditor
                      linkContextPath={linkContextPath}
                      linksClickable={linksClickable}
                      onNavigate={onNavigate}
                      refreshVersion={refreshVersion}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
    </div>
  );
});
