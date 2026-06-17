/** LaTeX-style inline notes in draft.md — stripped before AI prompts. */
const INLINE_NOTE_PATTERN = /\\([a-zA-Z]{1,12})\{([^}]*)\}/g;

export function stripInlineNotes(markdown: string): string {
  return markdown
    .replace(INLINE_NOTE_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function listInlineNotes(markdown: string): Array<{ author: string; text: string }> {
  const notes: Array<{ author: string; text: string }> = [];
  const re = new RegExp(INLINE_NOTE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
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
  return ["\\usepackage{xcolor}", ...macros, ""].join("\n");
}
