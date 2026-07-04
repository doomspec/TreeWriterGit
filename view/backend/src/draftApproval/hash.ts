import { createHash } from "node:crypto";

import { stripInlineComments } from "../inlineComments.js";
import { stripInlineNotes } from "../inlineNotes.js";

/** Strip `\hl{color}{text}` — visual markup only, not a content edit for approval. */
function stripTextHighlightMacros(markdown: string): string {
  return markdown
    .replace(/\\hl\{[a-z]+\}\{([^}]*)\}/g, (_full, inner: string) => inner)
    .replace(/`⟦hl:[a-z]+:([\s\S]*?)⟧`/g, "$1")
    .replace(/`\[hl:[a-z]+:([\s\S]*?)\]`/g, "$1");
}

/** Normalize manuscript body before hashing (comments/notes/highlights must not flip approval). */
export function normalizeManuscriptForHash(markdown: string): string {
  return stripTextHighlightMacros(stripInlineComments(stripInlineNotes(markdown)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function manuscriptContentHash(markdown: string): string {
  const normalized = normalizeManuscriptForHash(markdown);
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `sha256:${digest}`;
}
