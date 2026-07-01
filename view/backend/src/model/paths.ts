import path from "node:path";
import { existsSync } from "node:fs";

import { ModelFsError, PAPER_ASSET_DIRS } from "./errors.js";
import { readIndexData } from "./ordering.js";

const PAPER_SLUG_RE = /^[a-z0-9][a-z0-9-_]*$/;

/** Validate a manuscript slug and return its model-relative path under `papers/`. */
export function resolvePaperRel(modelRoot: string, slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new ModelFsError("Invalid paper slug", 400);
  }
  if (!PAPER_SLUG_RE.test(trimmed)) {
    throw new ModelFsError("Invalid paper slug", 400);
  }
  const paperRel = `papers/${trimmed}`;
  resolveModelPath(modelRoot, paperRel);
  const normalized = toRelative(modelRoot, resolveModelPath(modelRoot, paperRel));
  if (normalized !== paperRel) {
    throw new ModelFsError("Invalid paper slug", 400);
  }
  return paperRel;
}

/** Resolve a model-relative path to an absolute path, rejecting any escape above modelRoot. */
export function resolveModelPath(modelRoot: string, relativePath: string): string {
  const absolutePath = path.resolve(modelRoot, relativePath || ".");
  if (absolutePath !== modelRoot && !absolutePath.startsWith(`${modelRoot}${path.sep}`)) {
    throw new ModelFsError("Path escapes model root", 400);
  }
  return absolutePath;
}

export function toRelative(modelRoot: string, absolutePath: string): string {
  return path.relative(modelRoot, absolutePath).split(path.sep).join("/");
}

/** Shell-safe single-quoted string for embedding in terminal commands. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Where top-level manuscript sections live: paper root, or legacy `sections/` wrapper. */
export async function resolveManuscriptSectionsRoot(
  modelRoot: string,
  paperRel: string,
): Promise<string> {
  const paperData = await readIndexData(modelRoot, paperRel);
  const sectionOrder = Array.isArray(paperData.section_order)
    ? (paperData.section_order as string[])
    : [];
  for (const name of sectionOrder) {
    if (PAPER_ASSET_DIRS.has(name)) continue;
    if (existsSync(path.join(modelRoot, paperRel, name, "INDEX.md"))) {
      return paperRel;
    }
  }

  const wrapperRel = `${paperRel}/sections`;
  if (existsSync(path.join(modelRoot, wrapperRel, "INDEX.md"))) {
    return wrapperRel;
  }
  return paperRel;
}

export function resolveChildPath(
  modelRoot: string,
  parentRel: string,
  childName: string,
): string | null {
  const direct = `${parentRel}/${childName}`;
  if (existsSync(path.join(modelRoot, direct))) return direct;
  const underSections = `${parentRel}/sections/${childName}`;
  if (existsSync(path.join(modelRoot, underSections))) return underSections;
  return null;
}

export function isNotesContainerRel(relPath: string): boolean {
  return /\/notes\/(literature|data|feedback)$/.test(relPath.replace(/\\/g, "/"));
}
