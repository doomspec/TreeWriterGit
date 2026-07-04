import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError, TEMP_NOTES_DOC, type NodeKind } from "./errors.js";
import { isNotesContainerRel, resolveModelPath } from "./paths.js";

export function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function tempNotesDocSkeleton(): string {
  return "";
}

/** Technical metadata only — hidden from authors in the UI. */
export function indexSkeleton(name: string, kind: NodeKind): string {
  const title = titleCase(name);
  if (kind === "unit") {
    return matter.stringify("\n", { kind: "unit", title, status: "outline", links: [] });
  }
  if (kind === "figure") {
    return matter.stringify("\n", {
      kind: "figure",
      title,
      status: "outline",
      figure_source: "source.mmd",
      figure_preview: null,
      links: [],
    });
  }
  if (kind === "table") {
    return matter.stringify("\n", {
      kind: "table",
      title,
      status: "outline",
      table_label: null,
      links: [],
    });
  }
  if (kind === "equation") {
    return matter.stringify("\n", {
      kind: "equation",
      title,
      status: "outline",
      equation_label: null,
      equation_source: "source.tex",
      links: [],
    });
  }
  return matter.stringify("\n", {
    kind,
    title,
    child_order: [],
    links: [],
    composed_at_commit: null,
  });
}

/** User-facing section overview — visible as "Outline" in the UI. */
export function outlineDocSkeleton(name: string, kind: NodeKind): string {
  const title = titleCase(name);
  if (kind === "unit") {
    return `# ${title}\n\nOverview:\n- _Main point, evidence, and citations — one bullet per claim._\n`;
  }
  if (kind === "figure") {
    return `# ${title}\n\n## Summary\n\n_Describe panels, axes, data sources, and what the reader should take away._\n`;
  }
  if (kind === "table") {
    return `# ${title}\n\n## Summary\n\n_Describe rows, columns, statistics, and what the reader should take away._\n`;
  }
  if (kind === "equation") {
    return `# ${title}\n\n## Summary\n\n_Describe variables, notation, and where this equation is used._\n`;
  }
  return `# ${title}\n\n## Summary\n\n_Overview of this section for authors and readers._\n\n## Outline\n\n`;
}

/** Create outline.md from INDEX.md body when missing (lazy migration). */
export async function materializeOutline(modelRoot: string, outlineRel: string): Promise<string> {
  const normalized = outlineRel.split(path.sep).join("/");
  if (normalized !== "outline.md" && !normalized.endsWith("/outline.md")) {
    throw new ModelFsError("Not an outline path", 400);
  }
  const outlineAbs = resolveModelPath(modelRoot, normalized);
  if (existsSync(outlineAbs)) {
    return readFile(outlineAbs, "utf8");
  }
  const dir = path.posix.dirname(normalized);
  const parentRel = dir === "." ? "" : dir;
  if (isNotesContainerRel(parentRel)) {
    throw new ModelFsError(`Notes containers do not use outline.md: ${normalized}`, 404);
  }
  const parentAbs = resolveModelPath(modelRoot, parentRel || ".");
  if (!existsSync(parentAbs)) {
    throw new ModelFsError(`Folder not found for ${normalized}`, 404);
  }
  const indexRel = parentRel ? `${parentRel}/INDEX.md` : "INDEX.md";
  const indexAbs = resolveModelPath(modelRoot, indexRel);
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`No INDEX.md for ${normalized}`, 404);
  }
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const fm = parsed.data as Record<string, unknown>;
  let content = parsed.content.trim();
  if (!content) {
    const name = parentRel ? path.posix.basename(parentRel) : "model";
    const rawKind = String(fm.kind ?? "section");
    const kind: NodeKind =
      rawKind === "unit" ||
      rawKind === "figure" ||
      rawKind === "table" ||
      rawKind === "equation" ||
      rawKind === "subsection" ||
      rawKind === "section"
        ? rawKind
        : "section";
    content = outlineDocSkeleton(name, kind);
  }
  if (!content.endsWith("\n")) {
    content += "\n";
  }
  await mkdir(path.dirname(outlineAbs), { recursive: true });
  await writeFile(outlineAbs, content, "utf8");
  return content;
}

/** Create blank draft.md when outline.md exists but draft is missing. */
export async function materializeDraft(modelRoot: string, draftRel: string): Promise<string> {
  const normalized = draftRel.split(path.sep).join("/");
  if (normalized !== "draft.md" && !normalized.endsWith("/draft.md")) {
    throw new ModelFsError("Not a draft path", 400);
  }
  const draftAbs = resolveModelPath(modelRoot, normalized);
  if (existsSync(draftAbs)) {
    return readFile(draftAbs, "utf8");
  }
  const dir = path.posix.dirname(normalized);
  const parentRel = dir === "." ? "" : dir;
  if (isNotesContainerRel(parentRel)) {
    throw new ModelFsError(`Notes containers do not use draft.md: ${normalized}`, 404);
  }
  const outlineRel = parentRel ? `${parentRel}/outline.md` : "outline.md";
  const outlineAbs = resolveModelPath(modelRoot, outlineRel);
  if (!existsSync(outlineAbs)) {
    throw new ModelFsError(`No outline.md for ${normalized}`, 404);
  }
  await mkdir(path.dirname(draftAbs), { recursive: true });
  await writeFile(draftAbs, "", "utf8");
  return "";
}

/** Create temp-notes.md when the node folder exists but scratchpad is missing. */
export async function materializeTempNotes(modelRoot: string, tempNotesRel: string): Promise<string> {
  const normalized = tempNotesRel.split(path.sep).join("/");
  if (normalized !== TEMP_NOTES_DOC && !normalized.endsWith(`/${TEMP_NOTES_DOC}`)) {
    throw new ModelFsError("Not a temp-notes path", 400);
  }
  const tempNotesAbs = resolveModelPath(modelRoot, normalized);
  if (existsSync(tempNotesAbs)) {
    return readFile(tempNotesAbs, "utf8");
  }
  const dir = path.posix.dirname(normalized);
  const parentRel = dir === "." ? "" : dir;
  if (isNotesContainerRel(parentRel)) {
    throw new ModelFsError(`Notes containers do not use temp-notes.md: ${normalized}`, 404);
  }
  const parentAbs = resolveModelPath(modelRoot, parentRel || ".");
  if (!existsSync(parentAbs)) {
    throw new ModelFsError(`Folder not found for ${normalized}`, 404);
  }
  const indexRel = parentRel ? `${parentRel}/INDEX.md` : "INDEX.md";
  const indexAbs = resolveModelPath(modelRoot, indexRel);
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`No INDEX.md for ${normalized}`, 404);
  }
  const skeleton = tempNotesDocSkeleton();
  await mkdir(path.dirname(tempNotesAbs), { recursive: true });
  await writeFile(tempNotesAbs, skeleton, "utf8");
  return skeleton;
}
