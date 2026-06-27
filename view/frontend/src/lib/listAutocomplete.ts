import type { FormatResult } from "@/lib/markdownFormat";

const BULLET_LINE = /^(\s*)([-*+])\s*(.*)$/;
const ORDERED_LINE = /^(\s*)(\d+)\.\s+(.*)$/;

function lineAtOffset(value: string, offset: number): {
  lineStart: number;
  lineEnd: number;
  line: string;
} {
  const safeOffset = Math.max(0, Math.min(offset, value.length));
  const lineStart = value.lastIndexOf("\n", Math.max(0, safeOffset - 1)) + 1;
  let lineEnd = value.indexOf("\n", safeOffset);
  if (lineEnd === -1) lineEnd = value.length;
  return { lineStart, lineEnd, line: value.slice(lineStart, lineEnd) };
}

/** Continue or exit a markdown list when Enter is pressed. */
export function continueListOnEnter(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): FormatResult | null {
  if (selectionStart !== selectionEnd) return null;

  const { lineStart, lineEnd, line } = lineAtOffset(value, selectionStart);
  const bulletMatch = line.match(BULLET_LINE);
  const orderedMatch = line.match(ORDERED_LINE);

  if (bulletMatch) {
    const indent = bulletMatch[1];
    const content = bulletMatch[3];
    if (!content.trim()) {
      const nextValue = value.slice(0, lineStart) + indent + value.slice(lineEnd);
      const cursor = lineStart + indent.length;
      return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
    }
    const insert = `\n${indent}- `;
    const nextValue = value.slice(0, selectionStart) + insert + value.slice(selectionStart);
    const cursor = selectionStart + insert.length;
    return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
  }

  if (orderedMatch) {
    const indent = orderedMatch[1];
    const content = orderedMatch[3];
    const number = Number.parseInt(orderedMatch[2], 10);
    if (!content.trim()) {
      const nextValue = value.slice(0, lineStart) + indent + value.slice(lineEnd);
      const cursor = lineStart + indent.length;
      return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
    }
    const insert = `\n${indent}${number + 1}. `;
    const nextValue = value.slice(0, selectionStart) + insert + value.slice(selectionStart);
    const cursor = selectionStart + insert.length;
    return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
  }

  return null;
}

export function handleListEnterKeyDown(options: {
  event: React.KeyboardEvent;
  value: string;
  selectionStart: number;
  selectionEnd: number;
  apply: (result: FormatResult) => void;
}): boolean {
  const { event, value, selectionStart, selectionEnd, apply } = options;
  if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  if (event.defaultPrevented) return false;

  const result = continueListOnEnter(value, selectionStart, selectionEnd);
  if (!result) return false;

  event.preventDefault();
  apply(result);
  return true;
}

export function isSelectionInListItem(container: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const node = selection.anchorNode;
  if (!node || !container.contains(node)) return false;
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return Boolean(element?.closest("li"));
}
