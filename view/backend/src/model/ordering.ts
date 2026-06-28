import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, readdir } from "node:fs/promises";
import matter from "gray-matter";

import { PAPER_ASSET_DIRS } from "./errors.js";
import { resolveChildPath, resolveModelPath } from "./paths.js";

const SKIP_CHILDREN = new Set(["notes", ".sessions", ".trash", ...PAPER_ASSET_DIRS]);

export async function readIndexData(
  modelRoot: string,
  relPath: string,
): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(modelRoot, relPath, "INDEX.md"), "utf8");
    return matter(raw).data as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Merge frontmatter child_order/section_order with on-disk directories (stable, deduped). */
export async function orderedChildren(modelRoot: string, dirRel: string): Promise<string[]> {
  const data = await readIndexData(modelRoot, dirRel);
  const sectionOrder = Array.isArray(data.section_order) ? (data.section_order as string[]) : [];
  let childOrder = Array.isArray(data.child_order) ? (data.child_order as string[]) : [];

  const sectionsRoot = `${dirRel}/sections`;
  if (sectionOrder.length === 0 && existsSync(path.join(modelRoot, sectionsRoot))) {
    const sectionsData = await readIndexData(modelRoot, sectionsRoot);
    childOrder = Array.isArray(sectionsData.child_order)
      ? (sectionsData.child_order as string[])
      : childOrder;
  }

  const order = sectionOrder.length > 0 ? sectionOrder : childOrder;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of order) {
    if (SKIP_CHILDREN.has(name)) continue;
    const childRel = resolveChildPath(modelRoot, dirRel, name);
    if (!childRel) continue;
    seen.add(name);
    result.push(name);
  }

  try {
    const entries = await readdir(path.join(modelRoot, dirRel), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_CHILDREN.has(entry.name) || seen.has(entry.name)) continue;
      if (entry.name === "sections" && order.length > 0) continue;
      result.push(entry.name);
    }
  } catch {
    // ignore unreadable dirs
  }

  return result;
}

const indexPathFor = (parentRel: string): string =>
  parentRel ? `${parentRel}/INDEX.md` : "INDEX.md";

type OrderKey = "child_order" | "section_order";

function orderKeyFor(data: Record<string, unknown>): OrderKey {
  if (data.kind === "paper") return "section_order";
  if (Array.isArray(data.section_order) && data.section_order.length > 0) return "section_order";
  return "child_order";
}

/** Patch child_order or section_order on a parent INDEX.md. */
export async function patchNodeOrder(
  modelRoot: string,
  parentRel: string,
  mutate: (order: string[]) => string[],
): Promise<void> {
  const indexRel = indexPathFor(parentRel);
  const indexAbs = resolveModelPath(modelRoot, indexRel);
  if (!existsSync(indexAbs)) {
    return;
  }
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const key = orderKeyFor(parsed.data as Record<string, unknown>);
  const current: string[] = Array.isArray(parsed.data[key]) ? (parsed.data[key] as string[]) : [];
  const data = { ...parsed.data, [key]: mutate([...current]) };
  await writeFile(indexAbs, matter.stringify(parsed.content, data), "utf8");
}

export async function reorderChildren(
  modelRoot: string,
  parentRel: string,
  childOrder: string[],
): Promise<void> {
  const { ModelFsError } = await import("./errors.js");
  if (!Array.isArray(childOrder)) {
    throw new ModelFsError("child_order must be an array", 400);
  }
  await patchNodeOrder(modelRoot, parentRel, () => [...childOrder]);
}
