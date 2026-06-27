export type MarkdownFormatAction =
  | "bold"
  | "italic"
  | "h1"
  | "h2"
  | "h3"
  | "paragraph"
  | "bulletList"
  | "orderedList"
  | "link"
  | "blockquote";

export type FormatResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function lineRange(value: string, start: number, end: number): { start: number; end: number } {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = value.length;
  return { start: lineStart, end: lineEnd };
}

function selectedLines(value: string, start: number, end: number): string[] {
  const { start: lineStart, end: lineEnd } = lineRange(value, start, end);
  return value.slice(lineStart, lineEnd).split("\n");
}

function replaceLineBlock(
  value: string,
  start: number,
  end: number,
  transform: (lines: string[]) => string[],
): FormatResult {
  const { start: lineStart, end: lineEnd } = lineRange(value, start, end);
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const nextLines = transform(lines);
  const block = nextLines.join("\n");
  const nextValue = value.slice(0, lineStart) + block + value.slice(lineEnd);
  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + block.length,
  };
}

const ATX_HEADING = /^(#{1,6})\s+/;
const BLOCKQUOTE = /^>\s?/;
const BULLET_LIST = /^[-*+]\s+/;
const ORDERED_LIST = /^\d+\.\s+/;

function setHeadingLevel(lines: string[], level: number): string[] {
  return lines.map((line) => {
    const stripped = line.replace(ATX_HEADING, "");
    if (!stripped.trim()) return line;
    return `${"#".repeat(level)} ${stripped}`;
  });
}

function clearBlockFormat(lines: string[]): string[] {
  return lines.map((line) => {
    let result = line;
    while (BLOCKQUOTE.test(result)) {
      result = result.replace(BLOCKQUOTE, "");
    }
    result = result.replace(ATX_HEADING, "");
    result = result.replace(BULLET_LIST, "");
    result = result.replace(ORDERED_LIST, "");
    return result;
  });
}

function prefixLines(lines: string[], prefix: string): string[] {
  return lines.map((line) => {
    if (!line.trim()) return line;
    if (line.startsWith(prefix)) return line;
    return `${prefix}${line}`;
  });
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  marker: string,
): FormatResult {
  const selected = value.slice(start, end);
  const markerLen = marker.length;

  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= markerLen * 2
  ) {
    const inner = selected.slice(markerLen, selected.length - markerLen);
    const nextValue = value.slice(0, start) + inner + value.slice(end);
    return {
      value: nextValue,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }

  if (selected.length === 0) {
    const insertion = marker + marker;
    const nextValue = value.slice(0, start) + insertion + value.slice(end);
    return {
      value: nextValue,
      selectionStart: start + markerLen,
      selectionEnd: start + markerLen,
    };
  }

  const wrapped = `${marker}${selected}${marker}`;
  const nextValue = value.slice(0, start) + wrapped + value.slice(end);
  return {
    value: nextValue,
    selectionStart: start + markerLen,
    selectionEnd: start + markerLen + selected.length,
  };
}

export function applyMarkdownFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownFormatAction,
): FormatResult {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));

  switch (action) {
    case "bold":
      return wrapSelection(value, start, end, "**");
    case "italic":
      return wrapSelection(value, start, end, "*");
    case "h1":
      return replaceLineBlock(value, start, end, (lines) => setHeadingLevel(lines, 1));
    case "h2":
      return replaceLineBlock(value, start, end, (lines) => setHeadingLevel(lines, 2));
    case "h3":
      return replaceLineBlock(value, start, end, (lines) => setHeadingLevel(lines, 3));
    case "paragraph":
      return replaceLineBlock(value, start, end, clearBlockFormat);
    case "bulletList":
      return replaceLineBlock(value, start, end, (lines) => prefixLines(lines, "- "));
    case "orderedList":
      return replaceLineBlock(value, start, end, (lines) =>
        lines.map((line, i) => {
          if (!line.trim()) return line;
          const stripped = line.replace(/^\d+\.\s+/, "");
          return `${i + 1}. ${stripped}`;
        }),
      );
    case "blockquote":
      return replaceLineBlock(value, start, end, (lines) => prefixLines(lines, "> "));
    case "link": {
      const selected = value.slice(start, end);
      if (selected.length === 0) {
        const insertion = "[](url)";
        const nextValue = value.slice(0, start) + insertion + value.slice(end);
        return {
          value: nextValue,
          selectionStart: start + 1,
          selectionEnd: start + 1,
        };
      }
      const wrapped = `[${selected}](url)`;
      const nextValue = value.slice(0, start) + wrapped + value.slice(end);
      const urlStart = start + wrapped.indexOf("url");
      return {
        value: nextValue,
        selectionStart: urlStart,
        selectionEnd: urlStart + 3,
      };
    }
    default:
      return { value, selectionStart: start, selectionEnd: end };
  }
}

/** Returns line indices (0-based) covered by a selection. */
export function lineIndicesForSelection(value: string, start: number, end: number): number[] {
  const lines = selectedLines(value, start, end);
  const { start: lineStart } = lineRange(value, start, end);
  const firstLine = value.slice(0, lineStart).split("\n").length - 1;
  return lines.map((_, i) => firstLine + i);
}
