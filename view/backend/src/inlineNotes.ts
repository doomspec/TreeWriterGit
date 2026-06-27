/** LaTeX-style inline notes in draft.md — stripped before AI prompts. */
const INLINE_NOTE_PATTERN = /\\([a-zA-Z]{1,12})\{([^}]*)\}/g;

/** Commands reserved for LaTeX / TreeWriter tokens — not author notes. */
const RESERVED_INLINE_NOTE_COMMANDS = new Set([
  "begin",
  "end",
  "cite",
  "emph",
  "figure",
  "hl",
  "label",
  "ref",
  "sqrt",
  "text",
  "textbf",
  "textit",
  "textcolor",
  "color",
  "todo",
  "caption",
  "includegraphics",
  "centering",
  "mu",
]);

function isInlineAuthorNote(match: RegExpExecArray): boolean {
  const author = match[1]?.toLowerCase();
  return Boolean(author && author !== "todo" && !RESERVED_INLINE_NOTE_COMMANDS.has(author));
}

export function stripInlineNotes(markdown: string): string {
  const re = new RegExp(INLINE_NOTE_PATTERN.source, "g");
  return markdown
    .replace(re, (full, author: string) => {
      if (RESERVED_INLINE_NOTE_COMMANDS.has(String(author).toLowerCase()) || author.toLowerCase() === "todo") {
        return full;
      }
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function listInlineNotes(markdown: string): Array<{ author: string; text: string }> {
  const notes: Array<{ author: string; text: string }> = [];
  const re = new RegExp(INLINE_NOTE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    if (!isInlineAuthorNote(match)) continue;
    notes.push({ author: match[1], text: match[2] });
  }
  return notes;
}

export function listInlineNoteAuthors(markdown: string): string[] {
  const authors = new Set<string>();
  for (const note of listInlineNotes(markdown)) {
    if (note.author.toLowerCase() !== "todo") authors.add(note.author);
  }
  return [...authors].sort();
}

/** Preamble macros so \\iy{…} and other author tags compile in exported .tex */
export function buildInlineNoteLatexPreamble(markdown: string): string {
  const authors = listInlineNoteAuthors(markdown);
  if (authors.length === 0) return "";
  const macros = authors.map(
    (author) =>
      `\\providecommand{\\${author}}[1]{\\begingroup\\color{gray}\\footnotesize\\texttt{[${author}]}~#1\\endgroup}`,
  );
  return [...macros, ""].join("\n");
}
