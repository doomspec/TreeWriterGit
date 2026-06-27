/** LaTeX planning tokens in drafts: \\label{key}, \\ref{key} — not author notes. */

export const LABEL_TOKEN_PREFIX = "§label:";
export const REF_TOKEN_PREFIX = "§ref:";

const LABEL_PATTERN = /\\label\{([^}]*)\}/g;
const REF_PATTERN = /\\ref\{([^}]*)\}/g;

function escapeTokenKey(key: string): string {
  return String(key).replace(/`/g, "'");
}

export function encodeLabelToken(key: string): string {
  return `\`${LABEL_TOKEN_PREFIX}${escapeTokenKey(key)}§\``;
}

export function encodeRefToken(key: string): string {
  return `\`${REF_TOKEN_PREFIX}${escapeTokenKey(key)}§\``;
}

export function parseLabelCodeSpan(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(LABEL_TOKEN_PREFIX) || !trimmed.endsWith("§")) return null;
  return trimmed.slice(LABEL_TOKEN_PREFIX.length, -1);
}

export function parseRefCodeSpan(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(REF_TOKEN_PREFIX) || !trimmed.endsWith("§")) return null;
  return trimmed.slice(REF_TOKEN_PREFIX.length, -1);
}

export function preprocessLabelTokensForMarkdown(markdown: string): string {
  return markdown.replace(LABEL_PATTERN, (_full, key: string) => encodeLabelToken(key));
}

export function preprocessRefTokensForMarkdown(markdown: string): string {
  return markdown.replace(REF_PATTERN, (_full, key: string) => encodeRefToken(key));
}

export function preprocessLatexTokensForMarkdown(markdown: string): string {
  return preprocessRefTokensForMarkdown(preprocessLabelTokensForMarkdown(markdown));
}

export function restoreLabelTokensFromMarkdown(markdown: string): string {
  return markdown.replace(
    new RegExp("`" + LABEL_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^`]*?)§`", "g"),
    (_full, key: string) => `\\label{${key}}`,
  );
}

export function restoreRefTokensFromMarkdown(markdown: string): string {
  return markdown.replace(
    new RegExp("`" + REF_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^`]*?)§`", "g"),
    (_full, key: string) => `\\ref{${key}}`,
  );
}

export function restoreLatexTokensFromMarkdown(markdown: string): string {
  return restoreRefTokensFromMarkdown(restoreLabelTokensFromMarkdown(markdown));
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

export function renderLabelBadgeHtml(key: string): string {
  return (
    `<span class="latex-label-badge" contenteditable="false" data-latex-label="${escapeHtmlAttr(key)}">` +
    `<span class="latex-label-badge__tag">label</span>` +
    `<span class="latex-label-badge__key">${escapeHtmlText(key)}</span>` +
    `</span>`
  );
}

export function renderRefBadgeHtml(key: string): string {
  return (
    `<span class="latex-ref-badge" contenteditable="false" data-latex-ref="${escapeHtmlAttr(key)}">` +
    `<span class="latex-ref-badge__tag">ref</span>` +
    `<span class="latex-ref-badge__key">${escapeHtmlText(key)}</span>` +
    `</span>`
  );
}

/** Turn encoded token code spans into non-editable badges in contenteditable HTML. */
export function enhanceLatexTokenBadges(html: string): string {
  return html
    .replace(
      new RegExp(`<code>${LABEL_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^<]*)§<\\/code>`, "g"),
      (_full, key: string) => renderLabelBadgeHtml(key),
    )
    .replace(
      new RegExp(`<code>${REF_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^<]*)§<\\/code>`, "g"),
      (_full, key: string) => renderRefBadgeHtml(key),
    );
}

export function restoreLatexTokenBadgesFromHtml(html: string): string {
  return html
    .replace(
      /<span class="latex-label-badge"[^>]*data-latex-label="([^"]*)"[^>]*>[\s\S]*?<\/span>/g,
      (_full, key: string) => `\\label{${key}}`,
    )
    .replace(
      /<span class="latex-ref-badge"[^>]*data-latex-ref="([^"]*)"[^>]*>[\s\S]*?<\/span>/g,
      (_full, key: string) => `\\ref{${key}}`,
    );
}
