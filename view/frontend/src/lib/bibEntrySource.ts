import type { BibLibraryEntry } from "@/lib/paperAssets";
import { scrollTextareaCaretIntoView, syncTextareaMirrorScroll } from "@/lib/textareaCaret";

function formatBibValue(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function entryToBibtex(entry: BibLibraryEntry): string {
  const fields = Object.entries(entry.fields).sort(([a], [b]) => a.localeCompare(b));
  return [
    `@${entry.type}{${entry.citeKey},`,
    ...fields.map(([key, value]) => `  ${key} = {${formatBibValue(value)}},`),
    "}",
  ].join("\n");
}

/** Scan raw BibTeX the same way the backend parser does. */
export function findBibEntryCharRange(content: string, citeKey: string): { start: number; end: number } | null {
  const text = content.replace(/\r\n/g, "\n");
  const targetKey = citeKey.trim();
  if (!targetKey) return null;

  let index = 0;
  while (index < text.length) {
    const at = text.indexOf("@", index);
    if (at === -1) break;

    let cursor = at + 1;
    while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;

    const typeStart = cursor;
    while (cursor < text.length && /[a-zA-Z]/.test(text[cursor] ?? "")) cursor += 1;
    const type = text.slice(typeStart, cursor).trim().toLowerCase();
    if (!type || type === "comment" || type === "preamble" || type === "string") {
      index = cursor + 1;
      continue;
    }

    while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;
    if (text[cursor] !== "{") {
      index = cursor + 1;
      continue;
    }
    const openBrace = cursor;
    cursor += 1;

    while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;
    const keyStart = cursor;
    while (cursor < text.length && !/[\s,}]/.test(text[cursor] ?? "")) cursor += 1;
    const foundKey = text.slice(keyStart, cursor).trim();

    let depth = 0;
    let entryEnd = openBrace;
    for (let i = openBrace; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          entryEnd = i + 1;
          break;
        }
      }
    }
    if (entryEnd <= at) {
      index = cursor + 1;
      continue;
    }

    if (foundKey === targetKey) {
      return { start: at, end: entryEnd };
    }

    index = entryEnd;
  }
  return null;
}

export function findBibEntryStartLine(content: string, citeKey: string): number | null {
  const range = findBibEntryCharRange(content, citeKey);
  if (!range) return null;
  return content.slice(0, range.start).split("\n").length;
}

/** Map an index in CRLF-normalized text back to the raw string offset. */
export function normalizedOffsetToRaw(raw: string, normalizedOffset: number): number {
  let rawIndex = 0;
  let normalizedIndex = 0;
  while (normalizedIndex < normalizedOffset && rawIndex < raw.length) {
    if (raw[rawIndex] === "\r" && raw[rawIndex + 1] === "\n") {
      rawIndex += 2;
    } else {
      rawIndex += 1;
    }
    normalizedIndex += 1;
  }
  return rawIndex;
}

export function buildLineStartIndex(text: string): Uint32Array {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return new Uint32Array(starts);
}

function lineIndexForOffset(lineStarts: Uint32Array, offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function scrollTextareaToOffset(
  textarea: HTMLTextAreaElement,
  rawOffset: number,
  lineStarts: Uint32Array,
  { margin = 64 }: { margin?: number } = {},
): void {
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(rawOffset, rawOffset);

  const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 24;
  const lineIndex = lineIndexForOffset(lineStarts, rawOffset);
  const scrollTop = Math.max(0, lineIndex * lineHeight - margin);
  textarea.scrollTop = scrollTop;

  const scrollHost = textarea.closest(".overflow-auto, .highlighting-textarea");
  if (scrollHost instanceof HTMLElement && scrollHost !== textarea) {
    scrollHost.scrollTop = scrollTop;
  }
}

export function scrollSourceToBibEntry(
  textarea: HTMLTextAreaElement,
  content: string,
  citeKey: string,
  options: {
    sourceRange?: { start: number; end: number };
    lineStarts?: Uint32Array;
  } = {},
): boolean {
  const rawBody = textarea.value || content;
  const normalizedBody = rawBody.replace(/\r\n/g, "\n");
  const range = options.sourceRange ?? findBibEntryCharRange(normalizedBody, citeKey);
  if (!range) return false;

  const rawStart = normalizedOffsetToRaw(rawBody, range.start);

  if (options.sourceRange && options.lineStarts) {
    scrollTextareaToOffset(textarea, rawStart, options.lineStarts);
    return true;
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(rawStart, rawStart);
  scrollTextareaCaretIntoView(textarea, rawStart, { margin: 64 });
  syncTextareaMirrorScroll(textarea);

  return true;
}
