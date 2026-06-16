import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

import { ModelFsError, resolveModelPath, toRelative } from "./modelFs.js";

export interface SearchHit {
  path: string;
  line: number;
  excerpt: string;
}

const EXCERPT_RADIUS = 50;

async function walkMarkdown(
  absDir: string,
  modelRoot: string,
  acc: string[],
): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(abs, modelRoot, acc);
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      acc.push(toRelative(modelRoot, abs));
    }
  }
}

function excerptAround(text: string, index: number): string {
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(text.length, index + EXCERPT_RADIUS);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
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

  const rootAbs = resolveModelPath(modelRoot, rootRel);
  const files: string[] = [];
  await walkMarkdown(rootAbs, modelRoot, files);

  const needle = q.toLowerCase();
  const hits: SearchHit[] = [];

  for (const rel of files.sort()) {
    if (hits.length >= limit) break;
    const abs = resolveModelPath(modelRoot, rel);
    let content: string;
    try {
      content = await readFile(abs, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const idx = line.toLowerCase().indexOf(needle);
      if (idx === -1) continue;
      hits.push({
        path: rel,
        line: i + 1,
        excerpt: excerptAround(line, idx),
      });
      if (hits.length >= limit) break;
    }
  }

  return hits;
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
