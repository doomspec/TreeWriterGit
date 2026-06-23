export function markdownWordCount(text: string): { words: number; characters: number } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, characters: 0 };
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  return { words, characters: trimmed.length };
}
