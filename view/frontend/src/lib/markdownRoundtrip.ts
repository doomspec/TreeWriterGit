import { marked } from "marked";
import TurndownService from "turndown";

import { preprocessInlineNotesForMarkdown, restoreInlineNotesFromMarkdown } from "@/lib/inlineNotes";
import { repairEditorMacroSyntax } from "@/lib/editorMacroRepair";
import {
  enhanceTextHighlightBadges,
  isPendingTrackChangeHtml,
  normalizeTextHighlightMacros,
  preprocessTextHighlightsForMarkdown,
  replaceTextHighlightMacrosInHtml,
  restoreTextHighlightBadgesFromHtml,
  restoreTextHighlightsFromMarkdown,
} from "@/lib/textHighlight";
import { preprocessLatexForMarkdownPreview } from "@/lib/latexPreview";
import {
  enhanceLatexTokenBadges,
  preprocessLatexTokensForMarkdown,
  restoreLatexTokenBadgesFromHtml,
  restoreLatexTokensFromMarkdown,
} from "@/lib/latexTokens";
import {
  EQUATION_BLOCK_LANG,
  FIGURE_BLOCK_LANG,
  preprocessMarkdownLinks,
} from "@/lib/modelTree";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

function normalizeListSpacing(markdown: string): string {
  return markdown.replace(/^(\s*[-*+])\s{2,}/gm, "$1 ");
}

function restoreCustomBlocks(markdown: string): string {
  let result = normalizeTextHighlightMacros(markdown);
  result = restoreLatexTokensFromMarkdown(result);
  result = restoreTextHighlightsFromMarkdown(result);
  result = restoreInlineNotesFromMarkdown(result);
  result = result.replace(
    new RegExp(`\`\`\`${FIGURE_BLOCK_LANG}\\s*\\n([\\s\\S]*?)\\n\`\`\``, "g"),
    (_match, target: string) => `::figure[${target.trim()}]`,
  );
  result = result.replace(
    new RegExp(`\`\`\`${EQUATION_BLOCK_LANG}\\s*\\n([\\s\\S]*?)\\n\`\`\``, "g"),
    (_match, target: string) => `::equation[${target.trim()}]`,
  );
  return normalizeListSpacing(result.trimEnd());
}

export function markdownToEditableHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  const processed = preprocessInlineNotesForMarkdown(
    preprocessTextHighlightsForMarkdown(
      preprocessLatexTokensForMarkdown(
        preprocessLatexForMarkdownPreview(
          preprocessMarkdownLinks(repairEditorMacroSyntax(markdown)),
          { math: "html" },
        ),
      ),
    ),
  );
  const html = marked.parse(processed, { async: false }) as string;
  return enhanceTextHighlightBadges(enhanceLatexTokenBadges(html));
}

/** Render markdown (or pending-diff HTML) for block display. */
export function renderBlockDisplayHtml(source: string): string {
  if (!source.trim()) return "";
  if (isPendingTrackChangeHtml(source)) {
    return replaceTextHighlightMacrosInHtml(source);
  }
  const html = markdownToEditableHtml(source);
  return html.replace(/<a(\s)/gi, '<a contenteditable="false"$1');
}

export function editableHtmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  const cleaned = restoreTextHighlightBadgesFromHtml(
    restoreLatexTokenBadgesFromHtml(html),
  )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\u00a0/g, " ");
  const markdown = turndown.turndown(cleaned);
  return repairEditorMacroSyntax(restoreCustomBlocks(markdown));
}
