import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { buildFigureLabelIndex } from "../../crossRefIndex.js";
import { resolveEquationMetadata } from "../../equations.js";
import {
  listPaperFigures,
  paperFiguresDir,
  resolveFigureMetadata,
  type FigureMetadata,
} from "../../figures.js";
import { resolveTableMetadata } from "../../tables.js";
import { readIndexData } from "../../model/index.js";
import {
  EQUATION_LINE,
  FIGURE_LINE,
  buildTableMarkdownExport,
  captionMarkdownToPlain,
  collapseParagraphLines,
  isEquationTargetPath,
  isFigureTargetPath,
  isInlineFigureLine,
  isTableTargetPath,
  stripPandocTableLabel,
  type ExportEmbedResult,
} from "./shared.js";

export type { ExportEmbedResult } from "./shared.js";
export { figureLabel } from "./shared.js";

/** Image URLs in DOCX markdown use this prefix; resolved by exportDocx image adapter. */
export const DOCX_ASSET_URL_PREFIX = "treewriter-asset:";

function docxAssetUrl(modelRelativePath: string): string {
  return `${DOCX_ASSET_URL_PREFIX}${modelRelativePath.replace(/\\/g, "/")}`;
}

function buildFigureMarkdownForDocx(
  meta: Awaited<ReturnType<typeof resolveFigureMetadata>>,
): { markdown: string; assetPath: string | null } {
  if (!meta) return { markdown: "", assetPath: null };

  const caption =
    meta.caption.trim() ||
    meta.summary?.trim() ||
    meta.title.trim();
  if (!caption) return { markdown: "", assetPath: null };

  const plainCaption = captionMarkdownToPlain(caption);

  const imagePath =
    meta.previewPath && !meta.previewPath.endsWith(".mmd") ? meta.previewPath : null;
  if (imagePath && !imagePath.toLowerCase().endsWith(".pdf")) {
    return {
      markdown: `![${plainCaption}](${docxAssetUrl(imagePath)})`,
      assetPath: imagePath,
    };
  }

  if (imagePath?.toLowerCase().endsWith(".pdf")) {
    return {
      markdown: `*${plainCaption}*\n\n*(PDF figure: ${path.posix.basename(imagePath)} — add a PNG preview for Word embedding)*`,
      assetPath: null,
    };
  }

  return {
    markdown: `*${plainCaption}*\n\n*(Figure source: ${meta.path})*`,
    assetPath: null,
  };
}

function figureDisplayNumber(meta: FigureMetadata, index: number): string {
  const titleMatch = meta.title.match(/fig\s*(S?\d+)/i);
  if (titleMatch) return titleMatch[1]!;
  const folderMatch = path.posix.basename(meta.path).match(/^fig(S?\d+)$/i);
  if (folderMatch) return folderMatch[1]!;
  return String(index + 1);
}

async function orderedPaperFigures(
  modelRoot: string,
  paperRel: string,
): Promise<FigureMetadata[]> {
  const all = await listPaperFigures(modelRoot, paperRel);
  const byPath = new Map(all.map((figure) => [figure.path, figure]));
  const figuresRoot = paperFiguresDir(paperRel);
  const ordered: FigureMetadata[] = [];
  const seen = new Set<string>();

  if (existsSync(path.join(modelRoot, figuresRoot, "INDEX.md"))) {
    const data = await readIndexData(modelRoot, figuresRoot);
    const childOrder = Array.isArray(data.child_order) ? (data.child_order as string[]) : [];
    for (const child of childOrder) {
      const rel = path.posix.join(figuresRoot, child);
      const meta = byPath.get(rel);
      if (meta) {
        ordered.push(meta);
        seen.add(meta.path);
      }
    }
  }

  for (const meta of all) {
    if (!seen.has(meta.path)) ordered.push(meta);
  }
  return ordered;
}

/** Replace LaTeX figure cross-refs with human-readable Fig. N panel labels for Word. */
export function replaceFigureRefsForDocx(
  markdown: string,
  labelIndex: Map<string, FigureMetadata>,
  numberByPath: Map<string, string>,
): string {
  const resolve = (key: string): string | null => {
    const meta =
      labelIndex.get(key) ??
      labelIndex.get(key.toLowerCase()) ??
      labelIndex.get(`fig:${key.replace(/^fig:/, "")}`);
    if (!meta) return null;
    return numberByPath.get(meta.path) ?? null;
  };

  const formatLabel = (key: string, suffix: string): string => {
    const num = resolve(key);
    return num ? `Fig. ${num}${suffix}` : `Fig. ${key}${suffix}`;
  };

  let result = markdown.replace(
    /\(((?:Fig\.|Figure)\.?\s*)\\ref\{([^}]+)\}([A-Za-z0-9]*)\)/gi,
    (_full, _figPrefix: string, key: string, suffix: string) => `(${formatLabel(key, suffix)})`,
  );

  result = result.replace(
    /\b((?:Fig\.|Figure)\.?\s*)\\ref\{([^}]+)\}([A-Za-z0-9]*)/gi,
    (_full, _figPrefix: string, key: string, suffix: string) => formatLabel(key, suffix),
  );

  result = result.replace(/\\ref\{([^}]+)\}([A-Za-z0-9]*)/g, (_full, key: string, suffix: string) => {
    const num = resolve(key);
    return num ? `Fig. ${num}${suffix}` : suffix ? `${key}${suffix}` : key;
  });

  return result;
}

async function appendPaperFiguresSectionForDocx(
  modelRoot: string,
  paperRel: string,
  markdown: string,
  assets: string[],
): Promise<{ markdown: string; assets: string[] }> {
  const figures = await orderedPaperFigures(modelRoot, paperRel);
  if (figures.length === 0) return { markdown, assets };

  const numberByPath = new Map<string, string>();
  figures.forEach((meta, index) => {
    numberByPath.set(meta.path, figureDisplayNumber(meta, index));
  });

  const blocks: string[] = [];
  const nextAssets = [...assets];

  for (let i = 0; i < figures.length; i += 1) {
    const meta = figures[i]!;
    const num = figureDisplayNumber(meta, i);
    const { markdown: figureMd, assetPath } = buildFigureMarkdownForDocx(meta);
    if (!figureMd.trim()) continue;
    blocks.push(`### Figure ${num}\n\n${figureMd.trim()}`);
    if (assetPath && !nextAssets.includes(assetPath)) nextAssets.push(assetPath);
  }

  if (blocks.length === 0) return { markdown, assets: nextAssets };

  return {
    markdown: `${markdown.trim()}\n\n## Figures\n\n${blocks.join("\n\n")}\n`,
    assets: nextAssets,
  };
}

async function buildEquationMarkdownForDocx(
  modelRoot: string,
  meta: Awaited<ReturnType<typeof resolveEquationMetadata>>,
): Promise<string> {
  if (!meta?.sourcePath) return "";
  const abs = path.join(modelRoot, meta.sourcePath);
  if (!existsSync(abs)) return "";
  const equationSource = (await readFile(abs, "utf8")).trim();
  if (!equationSource) return "";

  const caption =
    meta.caption.trim() ||
    meta.summary?.trim() ||
    "";
  const parts: string[] = ["```math", equationSource, "```"];
  if (caption) parts.push("", `*${captionMarkdownToPlain(caption)}*`);
  return `${parts.join("\n")}\n\n`;
}

async function expandInlineFigureLinesInParagraphDocx(
  modelRoot: string,
  lines: string[],
): Promise<{ lines: string[]; deferred: string[] }> {
  const deferred: string[] = [];
  const nextLines = [...lines];

  for (let i = 0; i < nextLines.length; i += 1) {
    const match = FIGURE_LINE.exec(nextLines[i]?.trim() ?? "");
    if (!match || !isInlineFigureLine(nextLines, i)) continue;

    const meta = await resolveFigureMetadata(modelRoot, match[1].trim());
    if (!meta) continue;

    const { markdown, assetPath } = buildFigureMarkdownForDocx(meta);
    if (markdown) {
      deferred.push(markdown);
      void assetPath;
    }

    const alias = meta.title.trim() || path.posix.basename(meta.path);
    nextLines[i] = alias;
  }

  return { lines: nextLines, deferred };
}

async function expandParagraphEmbedsDocx(modelRoot: string, paragraph: string): Promise<string> {
  const trimmed = paragraph.trim();
  if (!trimmed) return "";

  if (FIGURE_LINE.test(trimmed) && !trimmed.includes("\n")) {
    const meta = await resolveFigureMetadata(modelRoot, FIGURE_LINE.exec(trimmed)![1].trim());
    const { markdown } = buildFigureMarkdownForDocx(meta);
    if (markdown) return `${markdown}\n\n`;
  }

  if (EQUATION_LINE.test(trimmed) && !trimmed.includes("\n")) {
    const meta = await resolveEquationMetadata(modelRoot, EQUATION_LINE.exec(trimmed)![1].trim());
    const block = await buildEquationMarkdownForDocx(modelRoot, meta);
    if (block.trim()) return block;
  }

  const tableLineMatch = /^\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]\s*$/.exec(trimmed);
  if (tableLineMatch && isTableTargetPath(tableLineMatch[1].trim())) {
    const meta = await resolveTableMetadata(modelRoot, tableLineMatch[1].trim());
    const tableMd = stripPandocTableLabel(await buildTableMarkdownExport(modelRoot, meta));
    if (tableMd.trim()) return tableMd;
  }

  let lines = trimmed.split("\n");
  const deferredBlocks: string[] = [];

  if (lines.some((line) => FIGURE_LINE.test(line.trim()))) {
    const inline = await expandInlineFigureLinesInParagraphDocx(modelRoot, lines);
    lines = inline.lines;
    deferredBlocks.push(...inline.deferred);
  }

  for (let i = 0; i < lines.length; i += 1) {
    const equationMatch = EQUATION_LINE.exec(lines[i]?.trim() ?? "");
    if (!equationMatch) continue;
    const meta = await resolveEquationMetadata(modelRoot, equationMatch[1].trim());
    const block = await buildEquationMarkdownForDocx(modelRoot, meta);
    if (!block.trim()) continue;
    deferredBlocks.push(block.trim());
    lines.splice(i, 1);
    i -= 1;
  }

  const body = collapseParagraphLines(lines);
  if (!body && deferredBlocks.length === 0) return trimmed;

  const parts: string[] = [];
  if (body) parts.push(body);
  if (deferredBlocks.length > 0) parts.push(deferredBlocks.join("\n\n"));
  return parts.join("\n\n");
}

async function expandInlineAssetWikilinksDocx(modelRoot: string, markdown: string): Promise<string> {
  const re = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(markdown)) !== null) {
    parts.push(markdown.slice(lastIndex, match.index));
    const target = match[1].trim();
    const alias = match[2]?.trim();
    if (isTableTargetPath(target) || isFigureTargetPath(target) || isEquationTargetPath(target)) {
      parts.push(alias ?? path.posix.basename(target));
    } else {
      parts.push(alias ?? target);
    }
    lastIndex = match.index + match[0].length;
  }

  parts.push(markdown.slice(lastIndex));
  return parts.join("");
}

/** Expand TreeWriter embeds to DOCX-friendly markdown (images, GFM tables, math fences). */
export async function expandManuscriptEmbedsForDocx(
  modelRoot: string,
  paperRel: string,
  markdown: string,
): Promise<ExportEmbedResult> {
  const assets: string[] = [];
  const figures = await listPaperFigures(modelRoot, paperRel);
  const labelIndex = buildFigureLabelIndex(figures);
  const orderedFigures = await orderedPaperFigures(modelRoot, paperRel);
  const numberByPath = new Map<string, string>();
  orderedFigures.forEach((meta, index) => {
    numberByPath.set(meta.path, figureDisplayNumber(meta, index));
  });

  let prepared = replaceFigureRefsForDocx(markdown, labelIndex, numberByPath);
  prepared = prepared.replace(/\\begin\{figure\}(?:\[[^\]]*\])?\s*/g, "");
  prepared = prepared.replace(/\\end\{figure\}\s*/g, "");

  const paragraphs = prepared.split(/\n\n+/);
  const expanded = await Promise.all(
    paragraphs.map((paragraph) => expandParagraphEmbedsDocx(modelRoot, paragraph)),
  );
  let result = expanded.filter(Boolean).join("\n\n");
  result = await expandInlineAssetWikilinksDocx(modelRoot, result);

  const withFigures = await appendPaperFiguresSectionForDocx(
    modelRoot,
    paperRel,
    result,
    assets,
  );
  result = withFigures.markdown;

  for (const match of result.matchAll(new RegExp(`${DOCX_ASSET_URL_PREFIX}([^)\\s]+)`, "g"))) {
    const rel = match[1]?.trim();
    if (rel && !assets.includes(rel)) assets.push(rel);
  }

  return { markdown: result, assets: [...new Set([...assets, ...withFigures.assets])] };
}
