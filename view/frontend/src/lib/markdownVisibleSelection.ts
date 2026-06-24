import { isInlineAuthorNoteMacro } from "@/lib/inlineNotes";
import { isPendingTrackChangeHtml } from "@/lib/textHighlight";

export type MarkdownSelectionRange = { start: number; end: number };

export type VisibleOffsetMap = {
  visibleText: string;
  /** Markdown index at the start of each visible character. */
  startToMarkdown: number[];
  /** Markdown index after each visible character. */
  endToMarkdown: number[];
};

function normalizeVisibleText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function tryMacroAt(
  markdown: string,
  index: number,
): { visible: string; end: number; markdownStarts: number[] } | null {
  const ref = /^\\ref\{([^}]*)\}/.exec(markdown.slice(index));
  if (ref) {
    const key = ref[1];
    const visible = `ref${key}`;
    const refStart = index + 1;
    const keyStart = index + 5;
    const markdownStarts = [
      ...Array.from({ length: 3 }, (_, offset) => refStart + offset),
      ...Array.from({ length: key.length }, (_, offset) => keyStart + offset),
    ];
    return { visible, end: index + ref[0].length, markdownStarts };
  }

  const label = /^\\label\{([^}]*)\}/.exec(markdown.slice(index));
  if (label) {
    const key = label[1];
    const visible = `label${key}`;
    const labelStart = index + 1;
    const keyStart = index + 7;
    const markdownStarts = [
      ...Array.from({ length: 5 }, (_, offset) => labelStart + offset),
      ...Array.from({ length: key.length }, (_, offset) => keyStart + offset),
    ];
    return { visible, end: index + label[0].length, markdownStarts };
  }

  const hl = /^\\hl\{[a-z]+\}\{([^}]*)\}/.exec(markdown.slice(index));
  if (hl) {
    const inner = hl[1];
    const innerStart = index + hl[0].indexOf(inner);
    const markdownStarts = Array.from({ length: inner.length }, (_, offset) => innerStart + offset);
    return { visible: inner, end: index + hl[0].length, markdownStarts };
  }

  const note = /^\\([a-zA-Z]{1,12})\{([^}]*)\}/.exec(markdown.slice(index));
  if (note && isInlineAuthorNoteMacro(note[1])) {
    const author = note[1];
    const text = note[2];
    const visible = `${author}${text}`;
    const authorStart = index + 1;
    const textStart = index + author.length + 2;
    const markdownStarts = [
      ...Array.from({ length: author.length }, (_, offset) => authorStart + offset),
      ...Array.from({ length: text.length }, (_, offset) => textStart + offset),
    ];
    return { visible, end: index + note[0].length, markdownStarts };
  }

  const qtyMuL = /^([\d.]+)~?\\mu\\text\{L\}/.exec(markdown.slice(index));
  if (qtyMuL) {
    const visible = `${qtyMuL[1]}µL`;
    const markdownStarts = Array.from({ length: visible.length }, (_, offset) => index + offset);
    return { visible, end: index + qtyMuL[0].length, markdownStarts };
  }

  const muL = /^\\mu\\text\{L\}/.exec(markdown.slice(index));
  if (muL) {
    const visible = "µL";
    const markdownStarts = Array.from({ length: visible.length }, (_, offset) => index + offset);
    return { visible, end: index + muL[0].length, markdownStarts };
  }

  const qtyMum = /^([\d.]+)~?\\mu\\text\{m\}/.exec(markdown.slice(index));
  if (qtyMum) {
    const visible = `${qtyMum[1]}µm`;
    const markdownStarts = Array.from({ length: visible.length }, (_, offset) => index + offset);
    return { visible, end: index + qtyMum[0].length, markdownStarts };
  }

  const mum = /^\\mu\\text\{m\}/.exec(markdown.slice(index));
  if (mum) {
    const visible = "µm";
    const markdownStarts = Array.from({ length: visible.length }, (_, offset) => index + offset);
    return { visible, end: index + mum[0].length, markdownStarts };
  }

  return null;
}

/** Approximate visible plain text for a markdown block (matches rendered block surfaces). */
export function buildMarkdownVisibleOffsetMap(markdown: string): VisibleOffsetMap {
  const startToMarkdown: number[] = [];
  const endToMarkdown: number[] = [];
  let visibleText = "";

  let i = 0;
  while (i < markdown.length) {
    const macro = tryMacroAt(markdown, i);
    if (macro) {
      for (let v = 0; v < macro.visible.length; v += 1) {
        const markdownStart = macro.markdownStarts[v] ?? i;
        startToMarkdown.push(markdownStart);
        endToMarkdown.push(markdownStart + 1);
        visibleText += macro.visible[v];
      }
      i = macro.end;
      continue;
    }

    if (markdown.startsWith("**", i)) {
      i += 2;
      continue;
    }
    if (markdown.startsWith("__", i)) {
      i += 2;
      continue;
    }
    if (markdown[i] === "*" || markdown[i] === "_") {
      i += 1;
      continue;
    }

    startToMarkdown.push(i);
    endToMarkdown.push(i + 1);
    visibleText += markdown[i];
    i += 1;
  }

  return { visibleText, startToMarkdown, endToMarkdown };
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

function findAllIndices(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const indices: number[] = [];
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    indices.push(index);
    index = haystack.indexOf(needle, index + 1);
  }
  return indices;
}

function findBestMatchInMarkdown(
  markdown: string,
  selectedText: string,
  hintStart: number,
): MarkdownSelectionRange | null {
  const matches = findAllIndices(markdown, selectedText);
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    return { start: matches[0], end: matches[0] + selectedText.length };
  }

  let best = matches[0];
  let bestDistance = Math.abs(matches[0] - hintStart);
  for (const match of matches.slice(1)) {
    const distance = Math.abs(match - hintStart);
    if (distance < bestDistance) {
      best = match;
      bestDistance = distance;
    }
  }
  return { start: best, end: best + selectedText.length };
}

function mapDomOffsetsToMarkdown(
  markdown: string,
  domOffsets: { start: number; end: number },
  domText: string,
): MarkdownSelectionRange | null {
  const map = buildMarkdownVisibleOffsetMap(markdown);
  if (normalizeVisibleText(map.visibleText) !== normalizeVisibleText(domText)) {
    return null;
  }

  const startIndex = Math.max(0, Math.min(domOffsets.start, map.startToMarkdown.length - 1));
  const endIndex = Math.max(0, Math.min(domOffsets.end, map.endToMarkdown.length));
  const start = map.startToMarkdown[startIndex] ?? 0;
  const end = endIndex === 0 ? start : (map.endToMarkdown[endIndex - 1] ?? markdown.length);
  return { start, end: Math.max(start, end) };
}

/** Resolve a DOM selection inside a rendered block surface to markdown offsets. */
export function resolveMarkdownSelectionRange(
  surface: HTMLElement,
  markdown: string,
): MarkdownSelectionRange | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const selectedText = selection.toString();
  if (!selectedText) return null;

  const domOffsets = selectionOffsets(surface);
  if (!domOffsets) return null;

  const domText = surface.textContent ?? "";
  const map = buildMarkdownVisibleOffsetMap(markdown);
  const hintStart = map.startToMarkdown[Math.min(domOffsets.start, map.startToMarkdown.length - 1)] ?? 0;

  if (!isPendingTrackChangeHtml(surface.innerHTML)) {
    const mapped = mapDomOffsetsToMarkdown(markdown, domOffsets, domText);
    if (mapped) return mapped;
  }

  return findBestMatchInMarkdown(markdown, selectedText, hintStart);
}
