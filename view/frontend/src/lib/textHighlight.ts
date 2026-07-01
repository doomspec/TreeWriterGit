/** Colored text highlights: `\hl{yellow}{text}` stored in markdown, rendered as badges. */
export const TEXT_HIGHLIGHT_PATTERN = /\\hl\{([a-z]+)\}\{([^}]*)\}/g;
const TEXT_HIGHLIGHT_PATTERN_TEST = /\\hl\{([a-z]+)\}\{([^}]*)\}/;

export const TEXT_HIGHLIGHT_COLORS = [
  {
    id: "yellow",
    label: "Yellow",
    className: "bg-yellow-200/90 text-inherit dark:bg-yellow-500/30",
    swatchClassName: "bg-yellow-300 dark:bg-yellow-500/70",
  },
  {
    id: "green",
    label: "Green",
    className: "bg-emerald-200/90 text-inherit dark:bg-emerald-500/30",
    swatchClassName: "bg-emerald-300 dark:bg-emerald-500/70",
  },
  {
    id: "blue",
    label: "Blue",
    className: "bg-sky-200/90 text-inherit dark:bg-sky-500/30",
    swatchClassName: "bg-sky-300 dark:bg-sky-500/70",
  },
  {
    id: "pink",
    label: "Pink",
    className: "bg-rose-200/90 text-inherit dark:bg-rose-500/30",
    swatchClassName: "bg-rose-300 dark:bg-rose-500/70",
  },
  {
    id: "orange",
    label: "Orange",
    className: "bg-orange-200/90 text-inherit dark:bg-orange-500/30",
    swatchClassName: "bg-orange-300 dark:bg-orange-500/70",
  },
  {
    id: "purple",
    label: "Purple",
    className: "bg-violet-200/90 text-inherit dark:bg-violet-500/30",
    swatchClassName: "bg-violet-300 dark:bg-violet-500/70",
  },
] as const;

export type TextHighlightColorId = (typeof TEXT_HIGHLIGHT_COLORS)[number]["id"];

export const DEFAULT_HIGHLIGHT_COLOR: TextHighlightColorId = "yellow";

const HIGHLIGHT_COLOR_IDS = new Set<string>(TEXT_HIGHLIGHT_COLORS.map((color) => color.id));

export function normalizeHighlightColor(colorId: string): TextHighlightColorId {
  return HIGHLIGHT_COLOR_IDS.has(colorId) ? (colorId as TextHighlightColorId) : DEFAULT_HIGHLIGHT_COLOR;
}

export function highlightColorClass(colorId: string): string {
  const normalized = normalizeHighlightColor(colorId);
  return TEXT_HIGHLIGHT_COLORS.find((color) => color.id === normalized)?.className ?? TEXT_HIGHLIGHT_COLORS[0].className;
}

export function wrapTextHighlight(colorId: TextHighlightColorId, selectedText: string): string {
  const color = normalizeHighlightColor(colorId);
  const body = selectedText.trim();
  if (!body) return "";
  return `\\hl{${color}}{${body}}`;
}

/** Repair double-escaped, bare-encoded, and split-word highlight macros. */
export function normalizeTextHighlightMacros(markdown: string): string {
  let result = markdown;
  while (/\\\\hl\{/.test(result)) {
    result = result.replace(/\\\\hl\{/g, "\\hl{");
  }
  result = result.replace(/⟦hl:([a-z]+):([\s\S]*?)⟧/g, (full, color: string, text: string, offset: number, whole: string) => {
    if (offset > 0 && whole[offset - 1] === "`") return full;
    const after = offset + full.length;
    if (after < whole.length && whole[after] === "`") return full;
    return `\`⟦hl:${normalizeHighlightColor(color)}:${text}⟧\``;
  });
  result = result.replace(
    /([A-Za-z]{1,40})\\hl\{([a-z]+)\}\{([a-z][^}]*)\}/g,
    (_full, prefix: string, color: string, inner: string) => {
      return `\\hl{${normalizeHighlightColor(color)}}{${prefix}${inner}}`;
    },
  );
  return result;
}

export function preprocessTextHighlightsForMarkdown(markdown: string): string {
  const normalized = normalizeTextHighlightMacros(markdown);
  return normalized.replace(TEXT_HIGHLIGHT_PATTERN, (_full, color: string, text: string) => {
    const safeColor = normalizeHighlightColor(color);
    const safe = String(text).replace(/`/g, "'");
    return `\`⟦hl:${safeColor}:${safe}⟧\``;
  });
}

export function parseTextHighlightCodeSpan(value: string): { color: TextHighlightColorId; text: string } | null {
  const match = /^⟦hl:([a-z]+):([\s\S]*)⟧$/.exec(value.trim());
  if (!match) return null;
  return { color: normalizeHighlightColor(match[1]), text: match[2] };
}

export function restoreTextHighlightsFromMarkdown(markdown: string): string {
  return normalizeTextHighlightMacros(
    markdown
      .replace(/`⟦hl:([a-z]+):([\s\S]*?)⟧`/g, (_full, color: string, text: string) => {
        return `\\hl{${normalizeHighlightColor(color)}}{${text}}`;
      })
      .replace(/`\[hl:([a-z]+):([\s\S]*?)\]`/g, (_full, color: string, text: string) => {
        return `\\hl{${normalizeHighlightColor(color)}}{${text}}`;
      }),
  );
}

export type RawMirrorPart = {
  text: string;
  highlightColor?: TextHighlightColorId;
  pendingClass?: string;
};

const RAW_TEXT_HIGHLIGHT_PATTERN =
  /\\hl\{([a-z]+)\}\{([^}]*)\}|`⟦hl:([a-z]+):([\s\S]*?)⟧`|`\[hl:([a-z]+):([\s\S]*?)\]`/g;

export function hasRawTextHighlights(text: string): boolean {
  return (
    TEXT_HIGHLIGHT_PATTERN_TEST.test(text) ||
    /`⟦hl:[a-z]+:/.test(text) ||
    /`\[hl:[a-z]+:/.test(text)
  );
}

/** Split a raw markdown line into mirror spans with optional text-highlight coloring. */
export function splitRawMirrorLine(line: string): RawMirrorPart[] {
  const parts: RawMirrorPart[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(RAW_TEXT_HIGHLIGHT_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: line.slice(lastIndex, index) });
    }
    if (match[1]) {
      const color = normalizeHighlightColor(match[1]);
      const inner = match[2];
      parts.push({ text: `\\hl{${color}}{` });
      parts.push({ text: inner, highlightColor: color });
      parts.push({ text: "}" });
    } else {
      const color = normalizeHighlightColor(match[3] || match[5]);
      const inner = match[4] || match[6] || "";
      const full = match[0];
      const openLen = full.indexOf(inner);
      if (openLen > 0) parts.push({ text: full.slice(0, openLen) });
      parts.push({ text: inner, highlightColor: color });
      const closeStart = openLen + inner.length;
      if (closeStart < full.length) parts.push({ text: full.slice(closeStart) });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < line.length) {
    parts.push({ text: line.slice(lastIndex) });
  }
  if (parts.length === 0) {
    parts.push({ text: line });
  }
  return parts;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescapeHtmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function hasTextHighlightMacros(markdown: string): boolean {
  return TEXT_HIGHLIGHT_PATTERN_TEST.test(markdown);
}

/** Plain text for pending-approval diffing — highlight macros are annotations, not content edits. */
export function stripTextHighlightMacrosForDiff(markdown: string): string {
  const normalized = normalizeTextHighlightMacros(restoreTextHighlightsFromMarkdown(markdown));
  return normalized.replace(/\\hl\{[a-z]+\}\{([^}]*)\}/g, (_full, inner: string) => inner);
}

export function isPendingTrackChangeHtml(source: string): boolean {
  return (
    source.includes("highlight-inline--pending") || source.includes("highlight-inline--deleted")
  );
}

/** Replace `\hl{color}{text}` macros embedded in pending-diff HTML. */
export function replaceTextHighlightMacrosInHtml(source: string): string {
  return source.replace(TEXT_HIGHLIGHT_PATTERN, (_full, color: string, text: string) =>
    renderTextHighlightBadgeHtml(color, text),
  );
}

export function renderTextHighlightBadgeHtml(colorId: string, text: string): string {
  const color = normalizeHighlightColor(colorId);
  return (
    `<mark class="text-highlight-badge text-highlight-${color}" contenteditable="false" data-highlight-color="${escapeHtmlAttr(color)}">` +
    `${escapeHtmlText(text)}</mark>`
  );
}

/** Turn encoded highlight code spans into colored marks in contenteditable HTML. */
export function enhanceTextHighlightBadges(html: string): string {
  return html.replace(
    /<code>⟦hl:([a-z]+):([\s\S]*?)⟧<\/code>/g,
    (_full, color: string, text: string) => renderTextHighlightBadgeHtml(color, unescapeHtmlText(text)),
  );
}

export function restoreTextHighlightBadgesFromHtml(html: string): string {
  return html.replace(
    /<mark class="text-highlight-badge[^"]*"[^>]*data-highlight-color="([^"]*)"[^>]*>([\s\S]*?)<\/mark>/g,
    (_full, color: string, text: string) => `\\hl{${normalizeHighlightColor(color)}}{${unescapeHtmlText(text)}}`,
  );
}

export type TextHighlightFormatResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export function applyTextHighlight(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  colorId: TextHighlightColorId,
): TextHighlightFormatResult {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);
  const fullMacro = /^\\hl\{([a-z]+)\}\{([^}]*)\}$/.exec(selected);
  if (fullMacro) {
    const inner = fullMacro[2];
    const nextValue = value.slice(0, start) + inner + value.slice(end);
    return {
      value: nextValue,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }

  const color = normalizeHighlightColor(colorId);
  const body = selected.trim();
  if (!body) {
    return { value, selectionStart: start, selectionEnd: end };
  }
  const prefix = `\\hl{${color}}{`;
  const wrapped = `${prefix}${body}}`;
  const nextValue = value.slice(0, start) + wrapped + value.slice(end);
  return {
    value: nextValue,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + body.length,
  };
}
