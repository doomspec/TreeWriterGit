/** Slug from any model path under `papers/{slug}/…`. */
export function paperSlugFromModelPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const match = path.replace(/\\/g, "/").match(/^papers\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Paper slug for review/export — current browse path, else last opened paper root. */
export function resolveActivePaperSlug(
  paperSlug: string | null,
  lastPaperPath: string | null,
): string | null {
  return paperSlug ?? paperSlugFromModelPath(lastPaperPath);
}
