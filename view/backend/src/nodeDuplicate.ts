import path from "node:path";
import { existsSync } from "node:fs";
import { cp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import {
  ModelFsError,
  orderedChildren,
  readIndexData,
  reorderChildren,
  resolveModelPath,
} from "./modelFs.js";

const DUPLICATABLE_KINDS = new Set(["section", "subsection", "unit"]);

function titleFromName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function uniqueCopyName(base: string, used: Set<string>): string {
  const root = `${base}-copy`;
  let candidate = root;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(candidate)) {
    throw new ModelFsError(`Cannot derive a valid copy name from ${JSON.stringify(base)}`, 400);
  }
  return candidate;
}

async function collectNodePaths(modelRoot: string, nodeRel: string): Promise<string[]> {
  const paths = [nodeRel];
  const indexAbs = path.join(modelRoot, nodeRel, "INDEX.md");
  if (!existsSync(indexAbs)) return paths;

  const data = await readIndexData(modelRoot, nodeRel);
  const kind = String(data.kind ?? "");
  if (kind === "unit" || kind === "figure" || kind === "table" || kind === "equation") {
    return paths;
  }

  for (const child of await orderedChildren(modelRoot, nodeRel)) {
    paths.push(...(await collectNodePaths(modelRoot, `${nodeRel}/${child}`)));
  }
  return paths;
}

/** Duplicate a section, subsection, or unit folder after the source in its parent order. */
export async function duplicateNode(
  modelRoot: string,
  nodeRel: string,
): Promise<{ path: string; paths: string[] }> {
  const normalized = nodeRel.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  resolveModelPath(modelRoot, normalized);

  const sourceAbs = path.join(modelRoot, normalized);
  const indexAbs = path.join(sourceAbs, "INDEX.md");
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`Not found: ${normalized}`, 404);
  }

  const data = await readIndexData(modelRoot, normalized);
  const kind = String(data.kind ?? "");
  if (!DUPLICATABLE_KINDS.has(kind)) {
    throw new ModelFsError("Only sections, subsections, and units can be duplicated", 400);
  }

  const parentRel = path.posix.dirname(normalized);
  if (!parentRel || parentRel === ".") {
    throw new ModelFsError("Cannot duplicate the model root", 400);
  }

  const baseName = path.posix.basename(normalized);
  const siblings = await orderedChildren(modelRoot, parentRel);
  const copyName = uniqueCopyName(baseName, new Set(siblings));
  const destRel = `${parentRel}/${copyName}`;
  const destAbs = path.join(modelRoot, destRel);

  await cp(sourceAbs, destAbs, { recursive: true });

  const parsed = matter(await readFile(path.join(destAbs, "INDEX.md"), "utf8"));
  const indexData = parsed.data as Record<string, unknown>;
  const title = String(indexData.title ?? titleFromName(copyName));
  const copyTitle = title.endsWith(" (copy)") ? title : `${title} (copy)`;
  await writeFile(
    path.join(destAbs, "INDEX.md"),
    matter.stringify(parsed.content, { ...indexData, title: copyTitle }),
    "utf8",
  );

  const order = siblings.includes(copyName) ? [...siblings] : [...siblings];
  if (!order.includes(copyName)) {
    const sourceIndex = order.indexOf(baseName);
    const insertAt = sourceIndex >= 0 ? sourceIndex + 1 : order.length;
    order.splice(insertAt, 0, copyName);
  }
  await reorderChildren(modelRoot, parentRel, order);

  return { path: destRel, paths: await collectNodePaths(modelRoot, destRel) };
}

/** List every file under a duplicated node (for change broadcasts). */
export async function listDuplicateFilePaths(
  modelRoot: string,
  nodeRel: string,
): Promise<string[]> {
  const paths: string[] = [];
  async function walk(rel: string): Promise<void> {
    const abs = path.join(modelRoot, rel);
    const info = await stat(abs);
    if (info.isFile()) {
      paths.push(rel);
      return;
    }
    paths.push(rel);
    const entries = await readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      await walk(`${rel}/${entry.name}`);
    }
  }
  await walk(nodeRel);
  return paths;
}
