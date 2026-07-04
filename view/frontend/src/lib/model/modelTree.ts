export type { ModelNode, OutlineItem } from "./modelTreeTypes";
export {
  DRAFT_DOC,
  INDEX_DOC,
  OUTLINE_DOC,
  PAPERS_ROOT,
  TEMP_NOTES_DOC,
  draftPathFor,
  indexPathFor,
  isDraftPath,
  isHiddenModelFile,
  isManuscriptDocPath,
  isManuscriptFileForContainer,
  isOutlineDocPath,
  isOutlinePath,
  isPaperRootPath,
  isTempNotesPath,
  isUnderPapers,
  outlinePathFor,
  parentPath,
  manuscriptContainerPathFromFile,
  tempNotesPathFor,
} from "../modelPaths";
export {
  displayFileLabel,
  findNode,
  childOrderForFolder,
  flattenFiles,
  resolveModelPathTarget,
  sortTreeChildren,
  transformTreeForDisplay,
  type NavigateTarget,
} from "./modelTreeQuery";

export {
  parseFrontmatterLinks,
  parseFrontmatterStatus,
  parseIndexFrontmatter,
  stripFrontmatter,
  type IndexMeta,
} from "../modelFrontmatter";
export {
  breadcrumbSegments,
  childCardsForFolder,
  childrenOf,
  isIndexStale,
  outlineForParent,
  outlineLinkTargets,
  papersBreadcrumbSegments,
  parseIndexOutline,
  parseOutlineSummary,
  resolveOutlineTarget,
  type IndexOutlineLink,
} from "../modelOutline";

import type { ModelNode, OutlineItem } from "./modelTreeTypes";
import { INDEX_DOC, OUTLINE_DOC, DRAFT_DOC } from "../modelPaths";
import { findNode, type NavigateTarget } from "./modelTreeQuery";
import { resolveOutlineTarget } from "../modelOutline";

/**
 * Folder with outline.md (and optionally draft.md) — editable outline + draft pair.
 *
 * When `INDEX.md` lacks an explicit `kind`, presence of outline/draft files implies a unit.
 * Meta-doc folders should set `kind: section` (or another container kind) to avoid mis-detection.
 */
export function isUnitFolder(node: ModelNode | null): boolean {
  if (!node) return false;
  const kind = folderNodeKind(node);
  if (kind === "unit") {
    return manuscriptChildDirectories(node).length === 0;
  }
  if (kind && (CONTAINER_KINDS.has(kind) || LEAF_EDITOR_KINDS.has(kind))) return false;
  if (!node.children) return false;
  if (manuscriptChildDirectories(node).length > 0) return false;
  const hasOutlineDraft = node.children.some(
    (c) => c.type === "file" && (c.name === OUTLINE_DOC || c.name === DRAFT_DOC),
  );
  if (!hasOutlineDraft) return false;
  if (isTableFolder(node)) return false;
  if (isEquationFolder(node)) return false;
  const hasFigureAsset = node.children.some(
    (c) =>
      c.type === "file" &&
      /\.(png|jpe?g|svg|mmd|gif|webp)$/i.test(c.name),
  );
  return !hasFigureAsset;
}

/** Table leaf folder under tables/ with outline + draft (no figure asset). */
export function isTableFolder(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  if (node.children.some((c) => c.type === "directory")) return false;
  if (!node.path.includes("/tables/")) return false;
  const hasOutline = node.children.some((c) => c.type === "file" && c.name === OUTLINE_DOC);
  const hasDraft = node.children.some((c) => c.type === "file" && c.name === DRAFT_DOC);
  const hasFigureAsset = node.children.some(
    (c) =>
      c.type === "file" &&
      /\.(png|jpe?g|svg|mmd|gif|webp)$/i.test(c.name),
  );
  return hasOutline && hasDraft && !hasFigureAsset;
}

/** Equation leaf folder under equations/ with outline + draft + LaTeX source. */
export function isEquationFolder(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  if (node.children.some((c) => c.type === "directory")) return false;
  if (!node.path.includes("/equations/")) return false;
  const hasOutline = node.children.some((c) => c.type === "file" && c.name === OUTLINE_DOC);
  const hasDraft = node.children.some((c) => c.type === "file" && c.name === DRAFT_DOC);
  const hasTex = node.children.some((c) => c.type === "file" && c.name.endsWith(".tex"));
  return hasOutline && hasDraft && hasTex;
}

/** Figure leaf folder: outline + draft + image/mermaid asset. */
export function isFigureFolder(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  if (node.children.some((c) => c.type === "directory")) return false;
  const hasOutline = node.children.some((c) => c.type === "file" && c.name === OUTLINE_DOC);
  const hasDraft = node.children.some((c) => c.type === "file" && c.name === DRAFT_DOC);
  const hasAsset = node.children.some(
    (c) =>
      c.type === "file" &&
      /\.(png|jpe?g|svg|mmd|gif|webp)$/i.test(c.name),
  );
  return hasOutline && hasDraft && hasAsset;
}

export function isLeafEditorFolder(node: ModelNode | null): boolean {
  return isUnitFolder(node) || isFigureFolder(node) || isTableFolder(node) || isEquationFolder(node);
}

/** Whether the sidebar should offer subsection/unit create on this folder. */
export function canAddManuscriptChildren(
  node: ModelNode | null,
  parentPath: string,
  paperPath: string,
): boolean {
  if (!parentPath.startsWith(paperPath)) return false;
  if (parentPath === paperPath) return true;

  const rel = parentPath.slice(paperPath.length + 1);
  if (/^(figures|tables|equations|notes)(\/|$)/.test(rel)) return false;
  if (isFigureFolder(node) || isTableFolder(node) || isEquationFolder(node)) return false;

  // Top-level sections (abstract, introduction, …) also carry outline/draft but hold children.
  if (!rel.includes("/")) return true;

  const kind = folderNodeKind(node);
  if (kind === "section" || kind === "subsection" || kind === "paper") return true;

  // Nested subsection containers may look like units until they gain child folders.
  if (node?.children?.some((child) => child.type === "directory")) return true;

  // Leaf unit under a section/subsection — not a create target.
  return !isUnitFolder(node);
}

export const EQUATION_LINK_PREFIX = "equation://";
export const EQUATION_BLOCK_LANG = "treewriter-equation";

/** Section container: has child folders (paper, section, subsection). */
export function isSectionContainer(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  const kind = folderNodeKind(node);
  if (kind) {
    if (CONTAINER_KINDS.has(kind)) return true;
    if (LEAF_EDITOR_KINDS.has(kind) || kind === "unit") return false;
  }
  return manuscriptChildDirectories(node).length > 0;
}

/** Resolve href to in-app navigation target. */
export function resolveNavigateTarget(folderPath: string, href: string): NavigateTarget | null {
  const resolved = resolveOutlineTarget(folderPath, href);
  if (!resolved) return null;
  if (
    resolved.endsWith(".md") &&
    !resolved.endsWith(`/${INDEX_DOC}`) &&
    !resolved.endsWith(`/${OUTLINE_DOC}`)
  ) {
    return { type: "file", path: resolved };
  }
  const folder = resolved
    .replace(/\/?INDEX\.md$/, "")
    .replace(/\/outline\.md$/, "");
  return { type: "folder", path: folder };
}

export const FIGURE_LINK_PREFIX = "figure://";
export const ASSET_LINK_PREFIX = "asset://";
export const FIGURE_BLOCK_LANG = "treewriter-figure";

/** Preprocess figure embeds and wikilinks before markdown parse. */
export function preprocessFigureEmbeds(markdown: string): string {
  let result = markdown;

  result = result.replace(/::figure\[([^\]]+)\]/g, (_match, target: string) => {
    return `\n\n\`\`\`${FIGURE_BLOCK_LANG}\n${target.trim()}\n\`\`\`\n\n`;
  });

  result = result.replace(/::equation\[([^\]]+)\]/g, (_match, target: string) => {
    return `\n\n\`\`\`${EQUATION_BLOCK_LANG}\n${target.trim()}\n\`\`\`\n\n`;
  });

  result = result.replace(
    /!\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias?: string) => {
      const alt = alias?.trim() || target.split("/").pop() || "figure";
      return `\n\n![${alt}](${ASSET_LINK_PREFIX}${target.trim()})\n\n`;
    },
  );

  result = result.replace(
    /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias?: string) => {
      const label = alias?.trim() || target.split("/").pop() || target;
      const trimmed = target.trim().replace(/\/INDEX\.md$/i, "");
      const isAsset = /\.(png|jpe?g|svg|mmd|gif|webp|tex)$/i.test(trimmed);
      if (isAsset) {
        return `\n\n![${label}](${ASSET_LINK_PREFIX}${trimmed})\n\n`;
      }
      if (trimmed.includes("/equations/")) {
        const equationPath = trimmed.replace(/\.md$/, "");
        return `[${label}](${EQUATION_LINK_PREFIX}${equationPath})`;
      }
      const isFigureCandidate =
        !trimmed.endsWith(".md") || trimmed.includes("/notes/data/");
      if (isFigureCandidate) {
        const figurePath = trimmed.replace(/\.md$/, "");
        return `[${label}](${FIGURE_LINK_PREFIX}${figurePath})`;
      }
      return `[${label}](${trimmed})`;
    },
  );

  return result;
}

/** Convert remaining wikilinks to markdown links for ReactMarkdown rendering. */
export function preprocessMarkdownLinks(markdown: string): string {
  return preprocessFigureEmbeds(markdown);
}

import { childrenOf } from "../modelOutline";

export function filterTree(nodes: ModelNode[], query: string): ModelNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function walk(node: ModelNode): ModelNode | null {
    const nameMatch = node.name.toLowerCase().includes(q);
    const pathMatch = node.path.toLowerCase().includes(q);
    if (node.type === "file") {
      return nameMatch || pathMatch ? node : null;
    }
    const filteredChildren = (node.children ?? [])
      .map(walk)
      .filter((n): n is ModelNode => n !== null);
    if (nameMatch || pathMatch || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  return nodes.map(walk).filter((n): n is ModelNode => n !== null);
}

export type PaperSectionItem = {
  name: string;
  path: string;
  title: string;
};

const PAPER_SKIP_FOLDERS = new Set(["notes", ".sessions", ".trash", "figures", "tables", "equations"]);

const CONTAINER_KINDS = new Set(["paper", "section", "subsection"]);
const LEAF_EDITOR_KINDS = new Set(["unit", "figure", "table", "equation"]);

function manuscriptChildDirectories(node: ModelNode): ModelNode[] {
  return (node.children ?? []).filter(
    (child) => child.type === "directory" && !PAPER_SKIP_FOLDERS.has(child.name),
  );
}

/** Resolve folder kind from INDEX frontmatter when the tree includes it. */
export function folderNodeKind(node: ModelNode | null): string | null {
  if (!node || node.type !== "directory") return null;
  return typeof node.kind === "string" && node.kind.trim() ? node.kind.trim() : null;
}

/** Paper root for top-level manuscript sections (flat layout), or legacy `sections/` wrapper. */
export function resolveManuscriptSectionsRoot(tree: ModelNode[], paperPath: string): string {
  for (const child of childrenOf(tree, paperPath)) {
    if (child.type !== "directory" || PAPER_SKIP_FOLDERS.has(child.name) || child.name === "sections") {
      continue;
    }
    return paperPath;
  }
  const wrapperPath = `${paperPath}/sections`;
  return findNode(tree, wrapperPath)?.type === "directory" ? wrapperPath : paperPath;
}

function orderedDirectoryChildren(
  tree: ModelNode[],
  folderPath: string,
  childOrder: string[],
): PaperSectionItem[] {
  const children = childrenOf(tree, folderPath).filter(
    (c) => c.type === "directory" && !PAPER_SKIP_FOLDERS.has(c.name),
  );
  const byName = new Map(children.map((c) => [c.name, c]));
  const ordered: PaperSectionItem[] = [];
  for (const name of childOrder) {
    if (PAPER_SKIP_FOLDERS.has(name)) continue;
    const node = byName.get(name);
    if (node) {
      ordered.push({ name, path: node.path, title: titleFromFolderName(name) });
    }
  }
  for (const node of children) {
    if (!ordered.some((s) => s.name === node.name)) {
      ordered.push({ name: node.name, path: node.path, title: titleFromFolderName(node.name) });
    }
  }
  return ordered;
}

function titleFromFolderName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Ordered child folders (subsections, units) under any paper folder. */
export function orderedChildFolders(
  tree: ModelNode[],
  folderPath: string,
  childOrder: string[],
): PaperSectionItem[] {
  return orderedDirectoryChildren(tree, folderPath, childOrder);
}

/** All folder paths under a paper (paper root + nested section/unit dirs). */
export function collectPaperFolderPaths(tree: ModelNode[], paperPath: string): string[] {
  const paths: string[] = [paperPath];
  const walk = (folderPath: string) => {
    for (const child of childrenOf(tree, folderPath)) {
      if (child.type !== "directory") continue;
      paths.push(child.path);
      walk(child.path);
    }
  };
  walk(paperPath);
  return paths;
}

/** Ordered top-level sections for a paper folder. */
export function sectionsForPaper(
  tree: ModelNode[],
  paperPath: string,
  sectionOrder: string[],
): PaperSectionItem[] {
  const sectionsRoot = resolveManuscriptSectionsRoot(tree, paperPath);
  const filteredOrder = sectionOrder.filter((name) => !PAPER_SKIP_FOLDERS.has(name));
  return orderedDirectoryChildren(tree, sectionsRoot, filteredOrder);
}
