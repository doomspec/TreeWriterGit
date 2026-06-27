const FTS_SPECIAL = /["'*^():[\]{}\\-]/g;

/** Prefix token query for FTS5 (case-insensitive via unicode61 tokenizer). */
export function buildFtsMatch(query: string): string {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(FTS_SPECIAL, ""))
    .filter(Boolean);
  if (terms.length === 0) return "";
  return terms.map((term) => `"${term}"*`).join(" AND ");
}
