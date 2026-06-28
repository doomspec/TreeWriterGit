import path from "node:path";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";

import { readIndexData } from "./ordering.js";

const FIGURE_ASSET_PATTERN = /\.(png|jpe?g|svg|mmd|gif|webp)$/i;

/** True when folder is a table leaf (kind: table). */
export async function isTableDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "table") return true;
  if (
    data.kind === "unit" ||
    data.kind === "figure" ||
    data.kind === "equation" ||
    data.kind === "section" ||
    data.kind === "subsection" ||
    data.kind === "paper"
  ) {
    return false;
  }
  return false;
}

/** True when folder is an equation leaf (kind: equation). */
export async function isEquationDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  return data.kind === "equation";
}

/** True when folder is a figure leaf (kind: figure or outline+draft+asset heuristic). */
export async function isFigureDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "table" || data.kind === "equation") return false;
  if (data.kind === "figure") return true;
  if (data.kind === "unit" || data.kind === "section" || data.kind === "subsection" || data.kind === "paper") {
    return false;
  }

  const abs = path.join(modelRoot, relPath);
  if (!existsSync(abs)) return false;

  const entries = await readdir(abs, { withFileTypes: true });
  const hasChildDir = entries.some(
    (entry) => entry.isDirectory() && entry.name !== ".sessions" && entry.name !== "notes",
  );
  if (hasChildDir) return false;

  const hasOutline = existsSync(path.join(abs, "outline.md"));
  const hasDraft = existsSync(path.join(abs, "draft.md"));
  const hasAsset = entries.some((entry) => entry.isFile() && FIGURE_ASSET_PATTERN.test(entry.name));
  return hasOutline && hasDraft && hasAsset;
}

/** True when folder is a leaf unit (kind-based with draft.md fallback for legacy trees). */
export async function isUnitDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "figure" || data.kind === "table" || data.kind === "equation") return false;
  if (data.kind === "unit") return true;
  if (data.kind === "section" || data.kind === "subsection" || data.kind === "paper") {
    return false;
  }
  if (!existsSync(path.join(modelRoot, relPath, "draft.md"))) return false;
  if (await isFigureDir(modelRoot, relPath)) return false;
  return true;
}

export type ManuscriptLeafKind = "unit" | "figure" | "table" | "equation";
export type ManuscriptNodeKind = ManuscriptLeafKind | "container";

/** Classify a node as leaf asset/unit or container (section/subsection/paper). */
export async function classifyManuscriptNode(
  modelRoot: string,
  relPath: string,
): Promise<ManuscriptNodeKind> {
  if (await isFigureDir(modelRoot, relPath)) return "figure";
  if (await isTableDir(modelRoot, relPath)) return "table";
  if (await isEquationDir(modelRoot, relPath)) return "equation";
  if (await isUnitDir(modelRoot, relPath)) return "unit";
  return "container";
}
