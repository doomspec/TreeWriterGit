import path from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";

import { isUnitDir, orderedChildren, resolveChildPath } from "../modelFs.js";
import { searchModel } from "../search.js";
import type { DispatchAction } from "./templates.js";
import type { ZoteroLocalConfig } from "../zoteroLocalConfig.js";
import { loadZoteroLocalConfig } from "../zoteroLocalConfig.js";

function parentPath(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function paperRelFromUnitPath(unitPath: string): string | null {
  const match = unitPath.match(/^papers\/([^/]+)/);
  return match ? `papers/${match[1]}` : null;
}

const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "being",
  "between",
  "could",
  "from",
  "have",
  "into",
  "more",
  "must",
  "only",
  "other",
  "shall",
  "should",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "with",
  "would",
]);

const SNIPPET_LIMIT = 1200;

/** Keywords from outline text for automatic FTS prefetch. */
export function extractSearchTerms(outline: string, maxTerms = 3): string[] {
  const words = outline
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !STOPWORDS.has(word));

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
    .slice(0, maxTerms)
    .map(([word]) => word);
}

async function readOutlineSnippet(modelRoot: string, unitRel: string): Promise<string> {
  try {
    return (await readFile(path.join(modelRoot, unitRel, "outline.md"), "utf8")).trim().slice(0, SNIPPET_LIMIT);
  } catch {
    return "";
  }
}

/** Neighbor unit outlines under the same parent folder. */
export async function gatherSiblingUnitOutlines(
  modelRoot: string,
  unitPath: string,
  maxSiblings = 4,
): Promise<string[]> {
  const parent = parentPath(unitPath);
  if (!parent) return [];

  const snippets: string[] = [];
  for (const child of await orderedChildren(modelRoot, parent)) {
    if (snippets.length >= maxSiblings) break;
    const childRel = resolveChildPath(modelRoot, parent, child);
    if (!childRel || childRel === unitPath) continue;
    if (!(await isUnitDir(modelRoot, childRel))) continue;
    const snippet = await readOutlineSnippet(modelRoot, childRel);
    if (snippet) snippets.push(`[${childRel}/outline.md]\n${snippet}`);
  }
  return snippets;
}

/** FTS hits scoped to the paper, excluding the current unit path. */
export async function gatherRelatedSearchHits(
  modelRoot: string,
  unitPath: string,
  outline: string,
  limit = 5,
): Promise<string[]> {
  const paperRel = paperRelFromUnitPath(unitPath);
  if (!paperRel) return [];

  const terms = extractSearchTerms(outline);
  if (terms.length === 0) return [];

  const query = terms.join(" ");
  const hits = await searchModel(modelRoot, query, paperRel, limit + 3);
  const unitPrefix = `${unitPath}/`;

  return hits
    .filter((hit) => !hit.path.startsWith(unitPrefix))
    .slice(0, limit)
    .map((hit) => `${hit.path}:${hit.line}  ${hit.excerpt}`);
}

/** Auto-enrich default dispatch context (skipped when user picked explicit files). */
export async function gatherAutomaticContextPrefetch(
  modelRoot: string,
  unitPath: string,
  action: DispatchAction,
  outline: string,
  contextPaths?: string[],
): Promise<string> {
  if (contextPaths && contextPaths.length > 0) return "";
  if (action === "summarize-outline" || action === "refresh-index" || action === "sync-outline") {
    return "";
  }

  const blocks: string[] = [];

  const siblings = await gatherSiblingUnitOutlines(modelRoot, unitPath);
  if (siblings.length > 0) {
    blocks.push(`SIBLING UNITS:\n${siblings.join("\n\n")}`);
  }

  const searchHits = await gatherRelatedSearchHits(modelRoot, unitPath, outline);
  if (searchHits.length > 0) {
    blocks.push(`RELATED PASSAGES (same paper):\n${searchHits.join("\n")}`);
  }

  return blocks.join("\n\n");
}

/** Zotero-only runtime block — CLI quick-ref lives in treewriter-context-cli skill. */
export async function buildDispatchContextCliBlock(repoRoot: string): Promise<string> {
  let zoteroLocal: ZoteroLocalConfig = { enabled: false, baseUrl: "http://127.0.0.1:23119/api" };
  try {
    zoteroLocal = await loadZoteroLocalConfig(repoRoot);
  } catch {
    return "";
  }

  if (!zoteroLocal.enabled) return "";

  return [
    "ZOTERO LOCAL (Settings → Extensions → enabled):",
    "  node ../scripts/tw-zotero.mjs search \"topic keywords\" --json",
    "  node ../scripts/tw-zotero.mjs import --keys ITEMKEY1,ITEMKEY2 --json",
    "  node ../scripts/tw-zotero.mjs snippet --keys cite_key1,cite_key2",
    "Then add [@cite_key] to the target draft.md.",
  ].join("\n");
}
