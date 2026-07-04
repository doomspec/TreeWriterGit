import { ModelFsError } from "../modelFs.js";

const MAX_TAGS = 32;
const MAX_TAG_LENGTH = 48;
const TAG_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

export function normalizeManuscriptTags(raw: unknown): string[] {
  if (raw == null) return [];
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,;\s]+/)
      : [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const tag = String(item).trim().toLowerCase().replace(/^-+|-+$/g, "");
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) {
      throw new ModelFsError(`Tag too long: ${JSON.stringify(tag)}`, 400);
    }
    if (!TAG_PATTERN.test(tag)) {
      throw new ModelFsError(`Invalid tag: ${JSON.stringify(tag)}`, 400);
    }
    if (seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
    if (normalized.length > MAX_TAGS) {
      throw new ModelFsError(`At most ${MAX_TAGS} tags allowed`, 400);
    }
  }
  return normalized;
}

export function normalizeProjectSlug(raw: unknown): string | null {
  if (raw == null) return null;
  const slug = String(raw).trim().toLowerCase().replace(/^-+|-+$/g, "");
  if (!slug) return null;
  if (!TAG_PATTERN.test(slug)) {
    throw new ModelFsError(`Invalid project slug: ${JSON.stringify(slug)}`, 400);
  }
  return slug;
}
