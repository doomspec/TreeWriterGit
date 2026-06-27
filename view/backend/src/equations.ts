import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import matter from "gray-matter";

import { parseOutlineSummary } from "./compose.js";
import {
  isEquationDir,
  isUnitDir,
  orderedChildren,
  readIndexData,
  resolveChildPath,
} from "./modelFs.js";

export type EquationMetadata = {
  kind: "equation-unit" | "equation-note";
  path: string;
  title: string;
  caption: string;
  summary: string | null;
  sourcePath: string | null;
  outlinePath: string | null;
  draftPath: string | null;
  equationLabel: string | null;
};

function stripLeadingH1(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "")
    .trim();
}

async function readEquationUnitMetadata(
  modelRoot: string,
  dirRel: string,
): Promise<EquationMetadata | null> {
  if (!(await isEquationDir(modelRoot, dirRel))) return null;

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

  const sourceRef = String(data.equation_source ?? "source.tex");
  const sourcePath = existsSync(path.join(modelRoot, dirRel, sourceRef))
    ? path.posix.join(dirRel, sourceRef)
    : null;

  return {
    kind: "equation-unit",
    path: dirRel,
    title,
    caption,
    summary,
    sourcePath,
    outlinePath,
    draftPath,
    equationLabel: data.equation_label ? String(data.equation_label) : null,
  };
}

async function readEquationNoteMetadata(
  modelRoot: string,
  noteRel: string,
): Promise<EquationMetadata | null> {
  const abs = path.join(modelRoot, noteRel);
  if (!existsSync(abs)) return null;
  const raw = await readFile(abs, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  if (data.kind !== "equation") return null;

  const title = String(data.title ?? path.posix.basename(noteRel, ".md"));
  const caption = String(data.caption ?? "").trim();
  const summary = parseOutlineSummary(raw) ?? (parsed.content.trim() || null);
  const sourceRef = String(data.equation_source ?? "source.tex");
  const noteDir = path.posix.dirname(noteRel);
  const sourcePath = existsSync(path.join(modelRoot, noteDir, sourceRef))
    ? path.posix.join(noteDir, sourceRef)
    : null;

  return {
    kind: "equation-note",
    path: noteRel.replace(/\.md$/, ""),
    title,
    caption,
    summary,
    sourcePath,
    outlinePath: noteRel,
    draftPath: null,
    equationLabel: data.equation_label ? String(data.equation_label) : null,
  };
}

export async function resolveEquationMetadata(
  modelRoot: string,
  dirRel: string,
): Promise<EquationMetadata | null> {
  return readEquationUnitMetadata(modelRoot, dirRel);
}

export function paperEquationsDir(paperRel: string): string {
  return path.posix.join(paperRel, "equations");
}

/** List equation targets under a paper (equations/ folder and notes/data). */
export async function listPaperEquations(
  modelRoot: string,
  paperRel: string,
): Promise<EquationMetadata[]> {
  const equations: EquationMetadata[] = [];
  const seen = new Set<string>();

  const equationsRoot = paperEquationsDir(paperRel);
  if (existsSync(path.join(modelRoot, equationsRoot))) {
    for (const child of await orderedChildren(modelRoot, equationsRoot)) {
      const childRel = resolveChildPath(modelRoot, equationsRoot, child);
      if (!childRel) continue;
      const meta = await readEquationUnitMetadata(modelRoot, childRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        equations.push(meta);
      }
    }
  }

  async function walk(dirRel: string): Promise<void> {
    if (dirRel === equationsRoot || dirRel.startsWith(`${equationsRoot}/`)) return;
    if (dirRel.includes("/notes/") && !dirRel.includes("/notes/data")) return;

    if (await isEquationDir(modelRoot, dirRel)) {
      const meta = await readEquationUnitMetadata(modelRoot, dirRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        equations.push(meta);
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
      const meta = await readEquationNoteMetadata(modelRoot, noteRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        equations.push(meta);
      }
    }
  }

  return equations;
}
