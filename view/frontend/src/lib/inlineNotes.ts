/** LaTeX-style inline notes: \iy{suggestion}, \ak{comment} — per-author change tracking. */
export const INLINE_NOTE_PATTERN = /\\([a-zA-Z]{1,12})\{([^}]*)\}/g;

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
    segments.push({ type: "note", author: match[1], text: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    segments.push({ type: "text", value: markdown.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: "text", value: markdown }];
}

/** Encode notes as single-backtick code spans so remark renders them without rehype-raw. */
export function preprocessInlineNotesForMarkdown(markdown: string): string {
  return markdown.replace(INLINE_NOTE_PATTERN, (_full, author: string, note: string) => {
    const safe = String(note).replace(/`/g, "'");
    return `\`⟦${author}:${safe}⟧\``;
  });
}

export function parseInlineNoteCodeSpan(value: string): { author: string; text: string } | null {
  const match = /^⟦([a-zA-Z]{1,12}):([\s\S]*)⟧$/.exec(value.trim());
  if (!match) return null;
  return { author: match[1], text: match[2] };
}

export function wrapInlineNote(macro: string, selectedText: string): string {
  const tag = macro.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "note";
  const body = selectedText.trim() || "…";
  return `\\${tag}{${body}}`;
}

export function stripInlineNotes(markdown: string): string {
  return markdown
    .replace(INLINE_NOTE_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function listInlineNotes(markdown: string): Array<{ author: string; text: string; index: number }> {
  const notes: Array<{ author: string; text: string; index: number }> = [];
  const re = new RegExp(INLINE_NOTE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    notes.push({ author: match[1], text: match[2], index: match.index });
  }
  return notes;
}
