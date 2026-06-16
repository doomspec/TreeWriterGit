import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import matter from "gray-matter";

import { resolveModelPath, toRelative } from "./modelFs.js";

export type GraphNodeType = "paper" | "section" | "unit" | "note" | "missing" | "doc";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  links: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const posix = path.posix;

/** Extract wikilink targets from text, stripping `![[embed]]`, `#anchors`, and `|aliases`. */
export function parseWikilinks(text: string): string[] {
  const out: string[] = [];
  const re = /!?\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const target = match[1].split("|")[0].split("#")[0].trim();
    if (target) {
      out.push(target);
    }
  }
  return out;
}

const stripMd = (value: string): string => value.replace(/\.md$/i, "");
const normalize = (value: string): string => posix.normalize(value).replace(/^\.\//, "");

async function walkMarkdown(absDir: string, modelRoot: string, acc: string[]): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(abs, modelRoot, acc);
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      acc.push(toRelative(modelRoot, abs));
    }
  }
}

function inferType(kind: unknown, id: string): GraphNodeType {
  if (kind === "unit") return "unit";
  if (kind === "section" || kind === "subsection") return "section";
  if (kind === "paper") return "paper";
  if (/(^|\/)notes(\/|$)/.test(id)) return "note";
  if (/(^|\/)papers\/[^/]+$/.test(id)) return "paper";
  return "doc";
}

/** Resolve a wikilink target (relative or basename) to a known node id, or null if missing. */
export function resolveTarget(
  target: string,
  sourceDir: string,
  nodeIds: Set<string>,
  byBasename: Map<string, string[]>
): string | null {
  const candidates = [
    normalize(posix.join(sourceDir, target)),
    stripMd(normalize(posix.join(sourceDir, target))),
    normalize(target),
    stripMd(normalize(target))
  ];
  for (const candidate of candidates) {
    if (candidate && nodeIds.has(candidate)) {
      return candidate;
    }
  }
  const base = stripMd(posix.basename(target));
  const matches = byBasename.get(base);
  if (matches && matches.length === 1) {
    return matches[0];
  }
  return null;
}

/**
 * Build a wikilink graph under `rootRel`. Folder nodes (dirs with INDEX.md) fold in their
 * INDEX.md + draft.md; standalone notes are their own nodes. INDEX.md/draft.md are not
 * separate nodes. Edges come from wikilinks in frontmatter `links` and body text.
 */
export async function buildGraph(modelRoot: string, rootRel = ""): Promise<Graph> {
  const rootAbs = resolveModelPath(modelRoot, rootRel);
  const mdFiles: string[] = [];
  await walkMarkdown(rootAbs, modelRoot, mdFiles);

  const folderDirs = new Set<string>();
  for (const file of mdFiles) {
    if (posix.basename(file) === "INDEX.md") {
      folderDirs.add(posix.dirname(file) === "." ? "" : posix.dirname(file));
    }
  }

  // Node id list: folder nodes (dir paths) + standalone non-INDEX/non-draft .md files.
  const nodeMeta = new Map<string, { sources: string[] }>();
  const addNode = (id: string, source: string) => {
    const existing = nodeMeta.get(id);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
    } else {
      nodeMeta.set(id, { sources: [source] });
    }
  };

  for (const dir of folderDirs) {
    const indexRel = dir ? `${dir}/INDEX.md` : "INDEX.md";
    addNode(dir, indexRel);
    const draftRel = dir ? `${dir}/draft.md` : "draft.md";
    if (mdFiles.includes(draftRel)) {
      addNode(dir, draftRel);
    }
  }
  for (const file of mdFiles) {
    const base = posix.basename(file);
    if (base === "INDEX.md" || base === "draft.md") {
      continue;
    }
    addNode(stripMd(file), file); // node id without .md, source is the real file
  }

  const nodeIds = new Set(nodeMeta.keys());
  const byBasename = new Map<string, string[]>();
  for (const id of nodeIds) {
    const base = stripMd(posix.basename(id) || id);
    const list = byBasename.get(base) ?? [];
    list.push(id);
    byBasename.set(base, list);
  }

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
  const seenEdge = new Set<string>();

  for (const [id, meta] of nodeMeta) {
    const isFolder = folderDirs.has(id);
    const sourceDir = isFolder ? id : posix.dirname(id).replace(/^\.$/, "");
    let label = stripMd(posix.basename(id) || "model");
    let kind: unknown;
    for (const source of meta.sources) {
      const abs = resolveModelPath(modelRoot, source);
      if (!existsSync(abs)) continue;
      const parsed = matter(await readFile(abs, "utf8"));
      if (posix.basename(source) === "INDEX.md") {
        if (typeof parsed.data.title === "string") label = parsed.data.title;
        kind = parsed.data.kind;
      }
      const fmLinks = Array.isArray(parsed.data.links) ? parsed.data.links.map(String).join("\n") : "";
      for (const target of [...parseWikilinks(fmLinks), ...parseWikilinks(parsed.content)]) {
        const resolved = resolveTarget(target, sourceDir, nodeIds, byBasename);
        const targetId = resolved ?? `missing:${target}`;
        const edgeKey = `${id}->${targetId}`;
        if (seenEdge.has(edgeKey) || targetId === id) continue;
        seenEdge.add(edgeKey);
        edges.push({ source: id, target: targetId });
        bump(id);
        bump(targetId);
        if (!resolved && !nodes.has(targetId)) {
          nodes.set(targetId, { id: targetId, label: target, type: "missing", links: 0 });
        }
      }
    }
    nodes.set(id, { id, label, type: inferType(kind, id), links: 0 });
  }

  for (const node of nodes.values()) {
    node.links = degree.get(node.id) ?? 0;
  }

  return { nodes: [...nodes.values()], edges };
}
