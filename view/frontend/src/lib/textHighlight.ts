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
  const body = selectedText.trim() || "…";
  return `\\hl{${color}}{${body}}`;
}

export function preprocessTextHighlightsForMarkdown(markdown: string): string {
  return markdown.replace(TEXT_HIGHLIGHT_PATTERN, (_full, color: string, text: string) => {
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
  return markdown.replace(/`⟦hl:([a-z]+):([\s\S]*?)⟧`/g, (_full, color: string, text: string) => {
    return `\\hl{${normalizeHighlightColor(color)}}{${text}}`;
  });
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
  const body = selected.trim() || "…";
  const prefix = `\\hl{${color}}{`;
  const wrapped = `${prefix}${body}}`;
  const nextValue = value.slice(0, start) + wrapped + value.slice(end);
  return {
    value: nextValue,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + body.length,
  };
}
