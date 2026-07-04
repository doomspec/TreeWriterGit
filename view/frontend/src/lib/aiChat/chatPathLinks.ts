import { paperRootFromPath } from "@/components/nav/PaperSelect";

/** A run of chat text, either plain or a resolved model-relative file link. */
export type ChatSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; path: string };

const FILE_EXT = "md|markdown|txt|png|jpe?g|svg|gif|webp|pdf|csv|xlsx?|bib|ya?ml|tex|docx|mmd";

// Candidate path tokens in assistant/user prose:
//   [bracketed/relative/path.md]  ·  /abs/.../model/papers/x/draft.md  ·  papers/x/intro/draft.md
// Bare tokens must contain a slash (avoids matching a lone "draft.md" mid-sentence).
const CANDIDATE = new RegExp(
  String.raw`\[[^\]\n]+?\.(?:${FILE_EXT})\]` +
    `|` +
    String.raw`/?(?:[\w.~-]+/)+[\w.~-]+\.(?:${FILE_EXT})`,
  "gi",
);

/**
 * Normalize a raw path token from chat prose to a model-relative path
 * (`papers/…`), or null when it can't be confidently resolved.
 * - Absolute paths are stripped through the last `/model/`.
 * - `papers/…` paths pass through.
 * - Bracketed/bare relative `.md` paths resolve against the current unit's
 *   paper root (from `currentPath`).
 */
export function normalizeChatPath(raw: string, currentPath: string): string | null {
  let token = raw.trim();
  if (token.startsWith("[") && token.endsWith("]")) token = token.slice(1, -1).trim();
  // Drop wrapping quotes/backticks and trailing sentence punctuation.
  token = token.replace(/^[`"']+/, "").replace(/[`"'.,;:]+$/, "");
  if (!token) return null;

  const modelIdx = token.lastIndexOf("/model/");
  if (modelIdx !== -1) return token.slice(modelIdx + "/model/".length);

  if (token.startsWith("model/")) return token.slice("model/".length);
  if (token.startsWith("papers/")) return token;

  // Relative fragment (e.g. "introduction/outline.md") — resolve against the paper root.
  if (!token.startsWith("/")) {
    const root = paperRootFromPath(currentPath);
    if (root) return `${root}/${token}`;
  }
  return null;
}

/** Split chat text into plain runs and resolved file links for inline rendering. */
export function segmentChatText(text: string, currentPath: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let lastIndex = 0;
  CANDIDATE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CANDIDATE.exec(text)) !== null) {
    const raw = match[0];
    const path = normalizeChatPath(raw, currentPath);
    if (path === null) continue; // leave unresolvable tokens as plain text
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "link", value: raw, path });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}
