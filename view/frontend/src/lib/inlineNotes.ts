/** LaTeX-style inline notes: \iy{suggestion}, \ak{comment} — per-author change tracking. */
export const INLINE_NOTE_PATTERN = /\\([a-zA-Z]{1,12})\{([^}]*)\}/g;

/** LaTeX planning / asset macros — must not be treated as author notes. */
export const RESERVED_INLINE_MACROS = new Set([
  "begin",
  "caption",
  "cite",
  "centering",
  "emph",
  "end",
  "eq",
  "equation",
  "fig",
  "figure",
  "hl",
  "includegraphics",
  "it",
  "label",
  "ref",
  "section",
  "subsection",
  "subsubsection",
  "tab",
  "table",
  "textbf",
  "textit",
]);

export function isInlineAuthorNoteMacro(macro: string): boolean {
  return !RESERVED_INLINE_MACROS.has(macro.toLowerCase());
}

export type InlineNoteSegment =
  | { type: "text"; value: string }
  | { type: "note"; author: string; text: string };

export function authorNoteMacro(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toLowerCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toLowerCase();
  return "note";
}

export function splitInlineNotes(markdown: string): InlineNoteSegment[] {
  const segments: InlineNoteSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(INLINE_NOTE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: markdown.slice(lastIndex, match.index) });
    }
    if (isInlineAuthorNoteMacro(match[1])) {
      segments.push({ type: "note", author: match[1], text: match[2] });
    } else {
      segments.push({ type: "text", value: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    segments.push({ type: "text", value: markdown.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: "text", value: markdown }];
}

/** Encode notes as single-backtick code spans so remark renders them without rehype-raw. */
export function preprocessInlineNotesForMarkdown(markdown: string): string {
  return markdown.replace(INLINE_NOTE_PATTERN, (full, author: string, note: string) => {
    if (!isInlineAuthorNoteMacro(author)) return full;
    const safe = String(note).replace(/`/g, "'");
    return `\`⟦${author}:${safe}⟧\``;
  });
}

export function parseInlineNoteCodeSpan(value: string): { author: string; text: string } | null {
  const match = /^⟦([a-zA-Z]{1,12}):([\s\S]*)⟧$/.exec(value.trim());
  if (!match) return null;
  return { author: match[1], text: match[2] };
}

/** Restore `\author{note}` macros from encoded preview code spans after HTML roundtrip. */
export function restoreInlineNotesFromMarkdown(markdown: string): string {
  return markdown.replace(/`⟦([a-zA-Z]{1,12}):([\s\S]*?)⟧`/g, (_full, author: string, note: string) => {
    return `\\${author}{${note}}`;
  });
}

export function wrapInlineNote(macro: string, selectedText: string): string {
  const tag = macro.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "note";
  const body = selectedText.trim() || "…";
  return `\\${tag}{${body}}`;
}

export function stripInlineNotes(markdown: string): string {
  return markdown
    .replace(INLINE_NOTE_PATTERN, (full, author: string) => (isInlineAuthorNoteMacro(author) ? "" : full))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function listInlineNotes(markdown: string): Array<{ author: string; text: string; index: number }> {
  const notes: Array<{ author: string; text: string; index: number }> = [];
  const re = new RegExp(INLINE_NOTE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    if (!isInlineAuthorNoteMacro(match[1])) continue;
    notes.push({ author: match[1], text: match[2], index: match.index });
  }
  return notes;
}
