import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { deleteNode, ModelFsError, moveNode, resolveModelPath } from "./modelFs.js";

export const TRASH_FOLDER = ".trash";
const MANIFEST_FILE = "manifest.json";

export type TrashedItem = {
  id: string;
  trashPath: string;
  originalPath: string;
  originalParent: string;
  label: string;
  deletedAt: string;
};

type TrashManifest = {
  items: TrashedItem[];
};

export function paperRootFromPath(relativePath: string): string | null {
  const match = relativePath.match(/^(papers\/[^/]+)/);
  return match?.[1] ?? null;
}

function trashRootForPaper(paperRel: string): string {
  return path.posix.join(paperRel, TRASH_FOLDER);
}

function manifestPath(modelRoot: string, paperRel: string): string {
  return path.join(modelRoot, trashRootForPaper(paperRel), MANIFEST_FILE);
}

async function readManifest(modelRoot: string, paperRel: string): Promise<TrashManifest> {
  const abs = manifestPath(modelRoot, paperRel);
  if (!existsSync(abs)) return { items: [] };
  try {
    const raw = await readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as TrashManifest;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

async function writeManifest(modelRoot: string, paperRel: string, manifest: TrashManifest): Promise<void> {
  const trashRoot = trashRootForPaper(paperRel);
  await mkdir(resolveModelPath(modelRoot, trashRoot), { recursive: true });
  await writeFile(manifestPath(modelRoot, paperRel), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function labelFromPath(relativePath: string): string {
  const base = path.posix.basename(relativePath).replace(/\.md$/, "");
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function uniqueTrashPath(modelRoot: string, paperRel: string, withinPaper: string): string {
  let candidate = path.posix.join(paperRel, TRASH_FOLDER, withinPaper);
  if (!existsSync(resolveModelPath(modelRoot, candidate))) return candidate;

  const dir = path.posix.dirname(withinPaper);
  const base = path.posix.basename(withinPaper);
  const ext = base.endsWith(".md") ? ".md" : "";
  const stem = ext ? base.slice(0, -ext.length) : base;
  candidate = path.posix.join(paperRel, TRASH_FOLDER, dir, `${stem}-archived-${Date.now()}${ext}`);
  return candidate;
}

/** Move a paper node or literature note into the paper trash (soft delete). */
export async function archiveNode(modelRoot: string, relativePath: string): Promise<TrashedItem> {
  const normalized = relativePath.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const paperRel = paperRootFromPath(normalized);
  if (!paperRel) {
    throw new ModelFsError("Only items under papers/{slug} can be moved to Removed", 400);
  }
  if (normalized === paperRel || normalized.startsWith(`${paperRel}/${TRASH_FOLDER}`)) {
    throw new ModelFsError("Cannot archive the paper root or trash folder", 400);
  }
  if (!existsSync(resolveModelPath(modelRoot, normalized))) {
    throw new ModelFsError(`Not found: ${normalized}`, 404);
  }

  const withinPaper = normalized.slice(paperRel.length + 1);
  const trashPath = uniqueTrashPath(modelRoot, paperRel, withinPaper);
  const originalParent = path.posix.dirname(normalized).replace(/^\.$/, "") || paperRel;

  await moveNode(modelRoot, normalized, trashPath);

  const item: TrashedItem = {
    id: randomUUID(),
    trashPath,
    originalPath: normalized,
    originalParent,
    label: labelFromPath(normalized),
    deletedAt: new Date().toISOString(),
  };

  const manifest = await readManifest(modelRoot, paperRel);
  manifest.items = manifest.items.filter((entry) => entry.trashPath !== trashPath);
  manifest.items.unshift(item);
  await writeManifest(modelRoot, paperRel, manifest);
  return item;
}

export async function listTrashedItems(modelRoot: string, paperRel: string): Promise<TrashedItem[]> {
  const normalized = paperRel.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!paperRootFromPath(normalized) || normalized !== paperRootFromPath(normalized)) {
    throw new ModelFsError("Invalid paper path", 400);
  }
  const manifest = await readManifest(modelRoot, normalized);
  return manifest.items.filter((item) => existsSync(resolveModelPath(modelRoot, item.trashPath)));
}

export async function restoreTrashedItem(
  modelRoot: string,
  paperRel: string,
  itemId: string,
): Promise<TrashedItem> {
  const normalized = paperRel.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const manifest = await readManifest(modelRoot, normalized);
  const item = manifest.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new ModelFsError("Removed item not found", 404);
  }
  if (!existsSync(resolveModelPath(modelRoot, item.trashPath))) {
    manifest.items = manifest.items.filter((entry) => entry.id !== itemId);
    await writeManifest(modelRoot, normalized, manifest);
    throw new ModelFsError("Removed item no longer exists on disk", 404);
  }
  if (existsSync(resolveModelPath(modelRoot, item.originalPath))) {
    throw new ModelFsError(`Cannot restore: ${item.originalPath} already exists`, 409);
  }

  await mkdir(resolveModelPath(modelRoot, item.originalParent), { recursive: true });
  await moveNode(modelRoot, item.trashPath, item.originalPath);

  manifest.items = manifest.items.filter((entry) => entry.id !== itemId);
  await writeManifest(modelRoot, normalized, manifest);
  return item;
}

export async function purgeTrashedItem(
  modelRoot: string,
  paperRel: string,
  itemId: string,
): Promise<TrashedItem> {
  const normalized = paperRel.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const manifest = await readManifest(modelRoot, normalized);
  const item = manifest.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new ModelFsError("Removed item not found", 404);
  }

  if (existsSync(resolveModelPath(modelRoot, item.trashPath))) {
    await deleteNode(modelRoot, item.trashPath, true);
  }

  manifest.items = manifest.items.filter((entry) => entry.id !== itemId);
  await writeManifest(modelRoot, normalized, manifest);
  return item;
}
