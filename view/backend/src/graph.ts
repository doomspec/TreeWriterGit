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
  /** `outline` = semantic link; `contains` = parent→child from child_order */
  kind?: "outline" | "contains";
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

/** Strip INDEX.md from outline links — graph nodes are folders, not INDEX files. */
export function normalizeGraphLinkTarget(target: string, sourceDir: string): string {
  const raw = target.trim().replace(/\/+$/, "");
  if (/^INDEX\.md$/i.test(raw)) {
    return sourceDir || ".";
  }
  return raw.replace(/\/INDEX\.md$/i, "");
}

export function linkTargetCandidates(target: string, sourceDir: string): string[] {
  const raw = target.trim();
  const out = new Set<string>();
  const add = (value: string) => {
    const normalized = normalize(value);
    if (!normalized || normalized === ".") return;
    out.add(normalized);
    const stripped = stripMd(normalized);
    if (stripped) out.add(stripped);
  };

  if (/^INDEX\.md$/i.test(raw)) {
    add(sourceDir);
  }

  const withoutIndex = raw.replace(/\/INDEX\.md$/i, "");
  for (const value of [raw, withoutIndex]) {
    add(posix.join(sourceDir, value));
    add(value);
  }
  return [...out];
}

/** True when the href points at INDEX.md (not a navigable graph node). */
export function isIndexMarkdownLink(target: string): boolean {
  return /(^|\/)INDEX\.md$/i.test(target.trim());
}

/** Resolve a wikilink target (relative or basename) to a known node id, or null if missing. */
export function resolveTarget(
  target: string,
  sourceDir: string,
  nodeIds: Set<string>,
  byBasename: Map<string, string[]>
): string | null {
  for (const candidate of linkTargetCandidates(target, sourceDir)) {
    if (nodeIds.has(candidate)) {
      return candidate;
    }
  }
  const base = stripMd(posix.basename(normalizeGraphLinkTarget(target, sourceDir)));
  const matches = byBasename.get(base);
  if (matches && matches.length === 1) {
    return matches[0];
  }
  return null;
}

/** Extract plain path targets from frontmatter `links:` arrays. */
export function parseFrontmatterLinkList(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.map(String).map((s) => s.trim()).filter(Boolean);
}

/** Markdown + wikilink targets from the ## Outline section (or legacy INDEX body). */
export function parseOutlineContentLinks(content: string): string[] {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const outlineMatch = body.match(/##\s+Outline\s*\n([\s\S]*?)(?=\n##\s|\n#[^#]|$)/i);
  const section = outlineMatch?.[1] ?? body;
  const out: string[] = [];
  const mdLink = /\[[^\]]+\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(section)) !== null) {
    const href = m[1].trim();
    if (href && !href.startsWith("http")) out.push(href);
  }
  out.push(...parseWikilinks(section));
  if (!outlineMatch) {
    out.push(...parseWikilinks(body));
  }
  return out;
}

/** Child folder names from INDEX frontmatter ordering. */
export function parseChildOrder(data: Record<string, unknown>): string[] {
  const sectionOrder = Array.isArray(data.section_order) ? data.section_order.map(String) : [];
  const childOrder = Array.isArray(data.child_order) ? data.child_order.map(String) : [];
  return sectionOrder.length > 0 ? sectionOrder : childOrder;
}

/**
 * Build a graph under `rootRel`. Edges come from INDEX.md frontmatter `links` (technical)
 * and from outline.md (## Outline + wikilinks). Draft prose does not create edges.
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
    if (base === "INDEX.md" || base === "draft.md" || base === "outline.md") {
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
      if (posix.basename(source) !== "INDEX.md") continue;
      const abs = resolveModelPath(modelRoot, source);
      if (!existsSync(abs)) continue;
      const indexRaw = await readFile(abs, "utf8");
      const parsed = matter(indexRaw);
      if (typeof parsed.data.title === "string") label = parsed.data.title;
      kind = parsed.data.kind;
      const targets: string[] = [];
      for (const rawLink of parseFrontmatterLinkList(parsed.data.links)) {
        const wiki = parseWikilinks(rawLink);
        if (wiki.length > 0) targets.push(...wiki);
        else targets.push(rawLink);
      }
      const outlineRel = isFolder ? (sourceDir ? `${sourceDir}/outline.md` : "outline.md") : "";
      if (outlineRel && mdFiles.includes(outlineRel)) {
        const outlineRaw = await readFile(resolveModelPath(modelRoot, outlineRel), "utf8");
        targets.push(...parseOutlineContentLinks(outlineRaw));
      } else if (!isFolder || !mdFiles.includes(outlineRel)) {
        // Legacy folders without outline.md: fall back to INDEX body links only when non-empty
        const body = parsed.content.trim();
        if (body) targets.push(...parseOutlineContentLinks(indexRaw));
      }
      for (const target of targets) {
        const resolved = resolveTarget(target, sourceDir, nodeIds, byBasename);
        if (!resolved && isIndexMarkdownLink(target)) {
          continue;
        }
        const targetId = resolved ?? `missing:${target}`;
        const edgeKey = `${id}->${targetId}:outline`;
        if (seenEdge.has(edgeKey) || targetId === id) continue;
        seenEdge.add(edgeKey);
        edges.push({ source: id, target: targetId, kind: "outline" });
        bump(id);
        bump(targetId);
        if (!resolved && !nodes.has(targetId)) {
          nodes.set(targetId, { id: targetId, label: target, type: "missing", links: 0 });
        }
      }

      for (const childName of parseChildOrder(parsed.data as Record<string, unknown>)) {
        const childCandidates = sourceDir
          ? [`${sourceDir}/${childName}`, childName]
          : [childName];
        for (const childId of childCandidates) {
          if (!nodeIds.has(childId) || childId === id) continue;
          const edgeKey = `${id}->${childId}:contains`;
          if (seenEdge.has(edgeKey)) continue;
          seenEdge.add(edgeKey);
          edges.push({ source: id, target: childId, kind: "contains" });
          bump(id);
          bump(childId);
          break;
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
