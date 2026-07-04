import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { approveDraftTarget } from "./draftApproval/workflow.js";
import {
  splitMarkdownParagraphUnits,
  uniqueImportSlug,
} from "./docxImportParse.js";
import {
  isUnitDir,
  ModelFsError,
  orderedChildren,
  readIndexData,
  reorderChildren,
  resolveModelPath,
  createNode,
} from "./modelFs.js";

/** Turn a leaf unit folder into a subsection container with one unit per draft paragraph. */
export async function convertUnitToSubsection(
  modelRoot: string,
  unitRel: string,
): Promise<{ path: string; childPaths: string[] }> {
  const normalized = unitRel.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  resolveModelPath(modelRoot, normalized);

  if (!(await isUnitDir(modelRoot, normalized))) {
    throw new ModelFsError("Only unit nodes can be converted to subsections", 400);
  }

  const indexAbs = path.join(modelRoot, normalized, "INDEX.md");
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`Not found: ${normalized}`, 404);
  }

  const parsedIndex = matter(await readFile(indexAbs, "utf8"));
  const data = parsedIndex.data as Record<string, unknown>;
  const title = String(data.title ?? path.posix.basename(normalized));
  const wasApproved = data.status === "approved";
  const links = Array.isArray(data.links) ? data.links : [];
  const { status: _status, ...rest } = data;

  let draftContent = "";
  const draftAbs = path.join(modelRoot, normalized, "draft.md");
  if (existsSync(draftAbs)) {
    draftContent = (await readFile(draftAbs, "utf8")).trim();
  }

  const units =
    draftContent.length > 0
      ? splitMarkdownParagraphUnits(draftContent)
      : [{ title, body: title }];

  await writeFile(
    indexAbs,
    matter.stringify(parsedIndex.content, {
      ...rest,
      kind: "subsection",
      title,
      child_order: [],
      links,
    }),
    "utf8",
  );

  for (const leaf of ["draft.md", "draft.approved.md"] as const) {
    const abs = path.join(modelRoot, normalized, leaf);
    if (existsSync(abs)) await rm(abs, { force: true });
  }

  const usedSlugs = new Set(await orderedChildren(modelRoot, normalized));
  const childSlugs: string[] = [];
  const childPaths: string[] = [];

  for (const unit of units) {
    const slug = uniqueImportSlug(unit.title, usedSlugs);
    const childRel = await createNode(modelRoot, normalized, slug, "unit");
    const draftRel = `${childRel}/draft.md`;
    await writeFile(path.join(modelRoot, draftRel), `${unit.body.trim()}\n`, "utf8");
    if (wasApproved) {
      await approveDraftTarget(modelRoot, draftRel, "unit-convert");
    }
    childSlugs.push(slug);
    childPaths.push(childRel, draftRel);
  }

  if (childSlugs.length > 0) {
    await reorderChildren(modelRoot, normalized, childSlugs);
  }

  return { path: normalized, childPaths };
}
