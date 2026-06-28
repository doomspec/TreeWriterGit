import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, rm, stat, readdir } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError, PAPER_ASSET_DIRS, TEMP_NOTES_DOC, type NodeKind } from "./errors.js";
import { resolveModelPath } from "./paths.js";
import { patchNodeOrder, readIndexData } from "./ordering.js";
import {
  indexSkeleton,
  outlineDocSkeleton,
  tempNotesDocSkeleton,
  titleCase,
} from "./materialize.js";

function assertNodeName(name: string): void {
  if (!name || name === "." || name === "..") {
    throw new ModelFsError(`Invalid node name: ${JSON.stringify(name)}`, 400);
  }
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(name)) {
    throw new ModelFsError(`Invalid node name: ${JSON.stringify(name)}`, 400);
  }
}

export async function createFile(
  modelRoot: string,
  relativePath: string,
  content = "",
): Promise<string> {
  const abs = resolveModelPath(modelRoot, relativePath);
  if (existsSync(abs)) {
    throw new ModelFsError(`Already exists: ${relativePath}`, 409);
  }
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
  return relativePath;
}

/** Create a container (section/subsection) or unit node, updating the parent INDEX child_order. */
export async function createNode(
  modelRoot: string,
  parentRel: string,
  name: string,
  kind: NodeKind,
): Promise<string> {
  assertNodeName(name);
  const nodeRel = parentRel ? `${parentRel}/${name}` : name;
  const abs = resolveModelPath(modelRoot, nodeRel);
  if (existsSync(abs)) {
    throw new ModelFsError(`Already exists: ${nodeRel}`, 409);
  }
  await mkdir(abs, { recursive: true });
  await writeFile(path.join(abs, "INDEX.md"), indexSkeleton(name, kind), "utf8");
  await writeFile(path.join(abs, "outline.md"), outlineDocSkeleton(name, kind), "utf8");
  if (kind === "section" || kind === "subsection" || kind === "unit") {
    await writeFile(path.join(abs, TEMP_NOTES_DOC), tempNotesDocSkeleton(), "utf8");
  }
  if (kind === "unit" || kind === "figure" || kind === "table" || kind === "equation") {
    await writeFile(
      path.join(abs, "draft.md"),
      kind === "figure"
        ? `**${titleCase(name)}.** _Caption text._\n`
        : kind === "table"
          ? `**${titleCase(name)}.** _Caption text._\n\n| Column A | Column B |\n| --- | --- |\n|  |  |\n`
          : kind === "equation"
            ? `**${titleCase(name)}.** _Caption describing the equation._\n`
            : "",
      "utf8",
    );
  }
  if (kind === "figure") {
    await writeFile(
      path.join(abs, "source.mmd"),
      "flowchart TD\n  A[Start] --> B[End]\n",
      "utf8",
    );
  }
  if (kind === "equation") {
    await writeFile(path.join(abs, "source.tex"), "E = mc^2\n", "utf8");
  }
  const parentData = parentRel ? await readIndexData(modelRoot, parentRel) : {};
  const skipParentOrder =
    parentData.kind === "paper" && PAPER_ASSET_DIRS.has(name) && kind === "section";
  if (!skipParentOrder) {
    await patchNodeOrder(modelRoot, parentRel, (order) =>
      order.includes(name) ? order : [...order, name],
    );
  }
  return nodeRel;
}

export async function deleteNode(
  modelRoot: string,
  relativePath: string,
  recursive = false,
): Promise<void> {
  const abs = resolveModelPath(modelRoot, relativePath);
  if (abs === modelRoot) {
    throw new ModelFsError("Refusing to delete model root", 400);
  }
  if (!existsSync(abs)) {
    throw new ModelFsError(`Not found: ${relativePath}`, 404);
  }
  const info = await stat(abs);
  if (info.isDirectory()) {
    const entries = (await readdir(abs)).filter(
      (e) =>
        e !== "INDEX.md" &&
        e !== "outline.md" &&
        e !== "draft.md" &&
        e !== TEMP_NOTES_DOC,
    );
    if (entries.length > 0 && !recursive) {
      throw new ModelFsError(`Directory not empty: ${relativePath}`, 409);
    }
    await rm(abs, { recursive: true, force: true });
  } else {
    await rm(abs, { force: true });
  }
  await patchNodeOrder(modelRoot, path.posix.dirname(relativePath).replace(/^\.$/, ""), (order) =>
    order.filter((n) => n !== path.posix.basename(relativePath)),
  );
}

export async function moveNode(modelRoot: string, from: string, to: string): Promise<void> {
  const fromAbs = resolveModelPath(modelRoot, from);
  const toAbs = resolveModelPath(modelRoot, to);
  if (!existsSync(fromAbs)) {
    throw new ModelFsError(`Not found: ${from}`, 404);
  }
  if (existsSync(toAbs)) {
    throw new ModelFsError(`Already exists: ${to}`, 409);
  }
  await mkdir(path.dirname(toAbs), { recursive: true });
  await rename(fromAbs, toAbs);
  const fromParent = path.posix.dirname(from).replace(/^\.$/, "");
  const toParent = path.posix.dirname(to).replace(/^\.$/, "");
  await patchNodeOrder(modelRoot, fromParent, (order) =>
    order.filter((n) => n !== path.posix.basename(from)),
  );
  await patchNodeOrder(modelRoot, toParent, (order) =>
    order.includes(path.posix.basename(to)) ? order : [...order, path.posix.basename(to)],
  );

  const oldName = path.posix.basename(from);
  const newName = path.posix.basename(to);
  if (oldName !== newName) {
    await syncRenamedNodeTitles(modelRoot, to, oldName);
  }
}

/** Keep INDEX title and outline heading aligned when a folder is renamed. */
async function syncRenamedNodeTitles(
  modelRoot: string,
  nodeRel: string,
  oldBasename: string,
): Promise<void> {
  const indexAbs = path.join(modelRoot, nodeRel, "INDEX.md");
  if (!existsSync(indexAbs)) return;

  const newTitle = titleCase(path.posix.basename(nodeRel));
  const oldDerivedTitle = titleCase(oldBasename);

  const parsed = matter(await readFile(indexAbs, "utf8"));
  const previousTitle =
    typeof parsed.data.title === "string" && parsed.data.title.trim()
      ? String(parsed.data.title).trim()
      : oldDerivedTitle;
  parsed.data.title = newTitle;
  await writeFile(indexAbs, matter.stringify(parsed.content, parsed.data), "utf8");

  const outlineAbs = path.join(modelRoot, nodeRel, "outline.md");
  if (!existsSync(outlineAbs)) return;

  const outlineRaw = await readFile(outlineAbs, "utf8");
  const headingMatch = outlineRaw.match(/^(\s*#(?!#)\s+)(.+?)(\s*(?:\r?\n|$))/);
  if (!headingMatch) return;

  const headingText = headingMatch[2]?.trim() ?? "";
  if (
    headingText === oldDerivedTitle ||
    headingText === previousTitle ||
    headingText === newTitle
  ) {
    const updated = outlineRaw.replace(
      /^(\s*#(?!#)\s+)(.+?)(\s*(?:\r?\n|$))/,
      `$1${newTitle}$3`,
    );
    if (updated !== outlineRaw) {
      await writeFile(outlineAbs, updated, "utf8");
    }
  }
}
