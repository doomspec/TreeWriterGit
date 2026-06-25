import type { FigureMetadata } from "@/lib/figures";
import type { CrossRefIndex } from "@/lib/paperAssets";
import { splitMarkdownIntoBlocks } from "@/lib/markdownBlocks";

const REF_PATTERN = /\\ref\{([^}]*)\}/g;
const LINKED_HEADING_PATTERN = /^#{2,4}\s+\[[^\]]+\]\(([^)]+)\)\s*$/;
const DEFAULT_SCOPE_KEY = "__document__";

/** Build a figure ref index from the backend cross-ref API response. */
export function figureLabelIndexFromCrossRef(
  index: CrossRefIndex | null | undefined,
): Map<string, FigureMetadata> {
  if (!index?.figureLabels) return new Map();
  return new Map(Object.entries(index.figureLabels));
}

export function resolveFigureByRefKey(
  refKey: string,
  index: Map<string, FigureMetadata>,
): FigureMetadata | null {
  const trimmed = refKey.trim();
  if (!trimmed) return null;
  return index.get(trimmed) ?? null;
}

/** Unique \\ref{…} keys in document order. */
export function extractFigureRefKeys(markdown: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(REF_PATTERN)) {
    const key = match[1]?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/** Resolve referenced figures in citation order, deduped by figure path. */
export function resolveReferencedFigures(
  markdown: string,
  index: Map<string, FigureMetadata>,
): FigureMetadata[] {
  const resolved: FigureMetadata[] = [];
  const seenPaths = new Set<string>();
  for (const refKey of extractFigureRefKeys(markdown)) {
    const meta = resolveFigureByRefKey(refKey, index);
    if (!meta || seenPaths.has(meta.path)) continue;
    seenPaths.add(meta.path);
    resolved.push(meta);
  }
  return resolved;
}

function linkedHeadingScopeKey(blockMarkdown: string): string | null {
  const match = LINKED_HEADING_PATTERN.exec(blockMarkdown.trim());
  return match?.[1]?.trim() ?? null;
}

function figuresFirstMentionedInBlock(
  blockMarkdown: string,
  index: Map<string, FigureMetadata>,
  seenPaths: Set<string>,
): FigureMetadata[] {
  const figures: FigureMetadata[] = [];
  for (const match of blockMarkdown.matchAll(REF_PATTERN)) {
    const meta = resolveFigureByRefKey(match[1] ?? "", index);
    if (!meta || seenPaths.has(meta.path)) continue;
    seenPaths.add(meta.path);
    figures.push(meta);
  }
  return figures;
}

/**
 * Place resolved figure previews after the first paragraph in each section/subsection/unit
 * scope that mentions them. The same figure may appear again in a different scope.
 */
export function computeScopedRefFigurePlacementsByBlockIndex(
  markdown: string,
  index: Map<string, FigureMetadata>,
): Map<number, FigureMetadata[]> {
  if (!markdown.trim() || index.size === 0) return new Map();

  const blocks = splitMarkdownIntoBlocks(markdown);
  const placements = new Map<number, FigureMetadata[]>();
  let scopeKey = DEFAULT_SCOPE_KEY;
  const seenByScope = new Map<string, Set<string>>();

  const scopeSeen = (): Set<string> => {
    let seen = seenByScope.get(scopeKey);
    if (!seen) {
      seen = new Set<string>();
      seenByScope.set(scopeKey, seen);
    }
    return seen;
  };

  for (const [blockIndex, block] of blocks.entries()) {
    const headingScope = linkedHeadingScopeKey(block.markdown);
    if (headingScope) {
      scopeKey = headingScope;
      if (!seenByScope.has(scopeKey)) seenByScope.set(scopeKey, new Set());
      continue;
    }

    const figures = figuresFirstMentionedInBlock(block.markdown, index, scopeSeen());
    if (figures.length > 0) placements.set(blockIndex, figures);
  }

  return placements;
}
