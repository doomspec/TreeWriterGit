import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { parseOutlineSummary } from "./compose.js";
import {
  isFigureDir,
  isTableDir,
  isUnitDir,
  ModelFsError,
  orderedChildren,
  readIndexData,
  resolveChildPath,
  resolveModelPath,
} from "./modelFs.js";

export const ASSET_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".mmd",
  ".tex",
  ".gif",
  ".webp",
  ".pdf",
]);

export type FigureMetadata = {
  kind: "figure-unit" | "figure-note";
  path: string;
  title: string;
  caption: string;
  summary: string | null;
  previewPath: string | null;
  sourcePath: string | null;
  outlinePath: string | null;
  draftPath: string | null;
  figureLabel: string | null;
};

const FIGURE_ASSET_NAMES = /\.(png|jpe?g|svg|mmd|gif|webp|pdf)$/i;
const SKIP_DIRS = new Set([".sessions", "notes", ".trash"]);

function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "")
    .trim();
}

export function isAllowedAssetPath(relativePath: string): boolean {
  const ext = path.posix.extname(relativePath).toLowerCase();
  return ASSET_EXTENSIONS.has(ext);
}

export function assetContentType(relativePath: string): string {
  const ext = path.posix.extname(relativePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    case ".mmd":
    case ".tex":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function resolveRelativeAsset(modelRoot: string, baseRel: string, assetRef: string): string | null {
  const normalized = assetRef.split(path.sep).join("/").trim();
  if (!normalized) return null;
  const candidate = normalized.includes("/")
    ? normalized
    : path.posix.join(baseRel, normalized);
  try {
    resolveModelPath(modelRoot, candidate);
    if (existsSync(path.join(modelRoot, candidate))) return candidate;
  } catch {
    return null;
  }
  return null;
}

async function listFigureAssets(modelRoot: string, dirRel: string): Promise<string[]> {
  const abs = path.join(modelRoot, dirRel);
  if (!existsSync(abs)) return [];
  const entries = await readdir(abs, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && FIGURE_ASSET_NAMES.test(entry.name))
    .map((entry) => path.posix.join(dirRel, entry.name));
}

async function readFigureNoteMetadata(
  modelRoot: string,
  noteRel: string,
): Promise<FigureMetadata | null> {
  const abs = path.join(modelRoot, noteRel);
  if (!existsSync(abs)) return null;
  const raw = await readFile(abs, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  if (data.kind !== "figure") return null;

  const noteDir = path.posix.dirname(noteRel);
  const title = String(data.title ?? path.posix.basename(noteRel, ".md"));
  const caption = String(data.caption ?? "").trim();
  const summary = parseOutlineSummary(raw) ?? (parsed.content.trim() || null);

  const previewPath =
    resolveRelativeAsset(modelRoot, noteDir, String(data.figure_path ?? data.figure_preview ?? "")) ??
    resolveRelativeAsset(modelRoot, noteDir, `${path.posix.basename(noteRel, ".md")}.png`);
  const sourcePath =
    resolveRelativeAsset(modelRoot, noteDir, String(data.figure_source ?? "")) ??
    (previewPath?.endsWith(".mmd") ? previewPath : null);

  return {
    kind: "figure-note",
    path: noteRel.replace(/\.md$/, ""),
    title,
    caption,
    summary,
    previewPath: previewPath && !previewPath.endsWith(".mmd") ? previewPath : null,
    sourcePath: sourcePath ?? (previewPath?.endsWith(".mmd") ? previewPath : null),
    outlinePath: noteRel,
    draftPath: null,
    figureLabel: data.figure_label ? String(data.figure_label) : null,
  };
}

async function readFigureUnitMetadata(
  modelRoot: string,
  dirRel: string,
): Promise<FigureMetadata | null> {
  if (!(await isFigureDir(modelRoot, dirRel))) return null;

  const data = await readIndexData(modelRoot, dirRel);
  const title = String(data.title ?? path.posix.basename(dirRel));

  let caption = "";
  const draftPath = path.posix.join(dirRel, "draft.md");
  if (existsSync(path.join(modelRoot, draftPath))) {
    caption = stripLeadingH1(await readFile(path.join(modelRoot, draftPath), "utf8"));
  }

  const outlinePath = path.posix.join(dirRel, "outline.md");
  let summary: string | null = null;
  if (existsSync(path.join(modelRoot, outlinePath))) {
    summary = parseOutlineSummary(await readFile(path.join(modelRoot, outlinePath), "utf8"));
  }

  const previewRef = String(data.figure_preview ?? "");
  const sourceRef = String(data.figure_source ?? "");
  let previewPath = previewRef
    ? resolveRelativeAsset(modelRoot, dirRel, previewRef)
    : null;
  let sourcePath = sourceRef ? resolveRelativeAsset(modelRoot, dirRel, sourceRef) : null;

  if (!previewPath || !sourcePath) {
    const assets = await listFigureAssets(modelRoot, dirRel);
    const raster = assets.find((asset) => !asset.endsWith(".mmd"));
    const mmd = assets.find((asset) => asset.endsWith(".mmd"));
    if (!previewPath) previewPath = raster ?? null;
    if (!sourcePath) sourcePath = mmd ?? raster ?? null;
  }

  if (previewPath?.endsWith(".mmd")) {
    if (!sourcePath) sourcePath = previewPath;
    previewPath = null;
  }

  return {
    kind: "figure-unit",
    path: dirRel,
    title,
    caption,
    summary,
    previewPath,
    sourcePath,
    outlinePath,
    draftPath,
    figureLabel: data.figure_label ? String(data.figure_label) : null,
  };
}

/** Resolve a figure unit folder or notes/data figure note to metadata. */
export async function resolveFigureMetadata(
  modelRoot: string,
  inputPath: string,
): Promise<FigureMetadata | null> {
  const normalized = inputPath.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return null;

  if (normalized.endsWith(".md")) {
    return readFigureNoteMetadata(modelRoot, normalized);
  }

  const asUnit = await readFigureUnitMetadata(modelRoot, normalized);
  if (asUnit) return asUnit;

  const withMd = `${normalized}.md`;
  if (existsSync(path.join(modelRoot, withMd))) {
    return readFigureNoteMetadata(modelRoot, withMd);
  }

  return null;
}

export function paperFiguresDir(paperRel: string): string {
  return path.posix.join(paperRel, "figures");
}

/** List figure targets under a paper (figures/ folder, inline units, notes/data). */
export async function listPaperFigures(
  modelRoot: string,
  paperRel: string,
): Promise<FigureMetadata[]> {
  const figures: FigureMetadata[] = [];
  const seen = new Set<string>();

  const figuresRoot = paperFiguresDir(paperRel);
  if (existsSync(path.join(modelRoot, figuresRoot))) {
    for (const child of await orderedChildren(modelRoot, figuresRoot)) {
      const childRel = resolveChildPath(modelRoot, figuresRoot, child);
      if (!childRel) continue;
      const meta = await readFigureUnitMetadata(modelRoot, childRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        figures.push(meta);
      }
    }
  }

  async function walk(dirRel: string): Promise<void> {
    if (dirRel === figuresRoot || dirRel.startsWith(`${figuresRoot}/`)) return;
    if (dirRel.includes("/notes/") && !dirRel.includes("/notes/data")) return;

    if (await isFigureDir(modelRoot, dirRel)) {
      const meta = await readFigureUnitMetadata(modelRoot, dirRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        figures.push(meta);
      }
      return;
    }

    if (!(await isUnitDir(modelRoot, dirRel))) {
      for (const child of await orderedChildren(modelRoot, dirRel)) {
        const childRel = resolveChildPath(modelRoot, dirRel, child);
        if (childRel) await walk(childRel);
      }
    }
  }

  await walk(paperRel);

  const dataNotesDir = path.posix.join(paperRel, "notes/data");
  if (existsSync(path.join(modelRoot, dataNotesDir))) {
    const entries = await readdir(path.join(modelRoot, dataNotesDir));
    for (const file of entries.filter((name) => name.endsWith(".md") && name !== "INDEX.md")) {
      const noteRel = path.posix.join(dataNotesDir, file);
      const meta = await readFigureNoteMetadata(modelRoot, noteRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        figures.push(meta);
      }
    }
  }

  return figures;
}

export const FIGURE_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".gif",
  ".webp",
  ".pdf",
]);

export function isFigureImageExtension(relativePath: string): boolean {
  const ext = path.posix.extname(relativePath).toLowerCase();
  return FIGURE_IMAGE_EXTENSIONS.has(ext);
}

function sanitizeFigureFilename(name: string): string {
  const base = path.posix.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!base || base === "." || base === "..") return "preview.png";
  return base;
}

/** Save an image into a figure unit folder or data note and update metadata. */
export async function uploadFigureImage(
  modelRoot: string,
  figurePath: string,
  filename: string,
  data: Buffer,
): Promise<{ assetPath: string; figure: FigureMetadata }> {
  const normalized = figurePath.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const meta = await resolveFigureMetadata(modelRoot, normalized);
  if (!meta) {
    throw new ModelFsError("Figure not found", 404);
  }

  const safeName = sanitizeFigureFilename(filename);
  if (!isFigureImageExtension(safeName)) {
    throw new ModelFsError(`Unsupported image type: ${path.posix.extname(safeName)}`, 400);
  }

  let assetRel: string;

  if (meta.kind === "figure-unit") {
    assetRel = path.posix.join(meta.path, safeName);
    resolveModelPath(modelRoot, assetRel);
    await writeFile(path.join(modelRoot, assetRel), data);

    const indexAbs = path.join(modelRoot, meta.path, "INDEX.md");
    const raw = await readFile(indexAbs, "utf8");
    const parsed = matter(raw);
    parsed.data.figure_preview = safeName;
    parsed.data.figure_source = safeName;
    await writeFile(indexAbs, matter.stringify(parsed.content, parsed.data), "utf8");
  } else {
    const noteRel = meta.outlinePath;
    if (!noteRel) {
      throw new ModelFsError("Figure note path missing", 400);
    }
    const noteDir = path.posix.dirname(noteRel);
    assetRel = path.posix.join(noteDir, safeName);
    resolveModelPath(modelRoot, assetRel);
    await writeFile(path.join(modelRoot, assetRel), data);

    const noteAbs = path.join(modelRoot, noteRel);
    const raw = await readFile(noteAbs, "utf8");
    const parsed = matter(raw);
    parsed.data.figure_path = safeName;
    parsed.data.figure_preview = safeName;
    parsed.data.figure_source = safeName;
    await writeFile(noteAbs, matter.stringify(parsed.content, parsed.data), "utf8");
  }

  const figure = await resolveFigureMetadata(modelRoot, normalized);
  if (!figure) {
    throw new ModelFsError("Figure metadata unavailable after upload", 500);
  }

  return { assetPath: assetRel, figure };
}
