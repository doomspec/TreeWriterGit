/** Count words in markdown/plain text. */
export function countMarkdownWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function markdownStats(text: string): { words: number; characters: number } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, characters: 0 };
  return { words: countMarkdownWords(trimmed), characters: trimmed.length };
}

/** @deprecated Use markdownStats */
export function markdownWordCount(text: string): { words: number; characters: number } {
  return markdownStats(text);
}
