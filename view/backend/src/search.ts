import { ModelFsError, resolveModelPath } from "./modelFs.js";
import { getModelIndexStore } from "./modelIndex/index.js";

export interface SearchHit {
  path: string;
  line: number;
  excerpt: string;
}

/** Case-insensitive full-text search under rootRel (default: whole model). */
export async function searchModel(
  modelRoot: string,
  query: string,
  rootRel = "",
  limit = 50,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  resolveModelPath(modelRoot, rootRel);
  const index = getModelIndexStore(modelRoot);
  await index.syncScope(rootRel);
  return index.search(q, rootRel, limit);
}

export function validateSearchQuery(query: string): string {
  const q = query.trim();
  if (!q) {
    throw new ModelFsError("q query parameter is required", 400);
  }
  if (q.length > 200) {
    throw new ModelFsError("q too long (max 200 chars)", 400);
  }
  return q;
}
