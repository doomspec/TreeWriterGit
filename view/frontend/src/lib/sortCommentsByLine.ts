export function sortCommentsByLine<T extends { line: number; created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.created_at.localeCompare(b.created_at);
  });
}
