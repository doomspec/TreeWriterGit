import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { resolveEquationMetadata } from "../equations.js";
import { resolveFigureMetadata } from "../figures.js";
import { resolveTableMetadata } from "../tables.js";
import {
  buildEquationLatexExportAsync,
  buildFigureLatexExport,
  buildTableMarkdownExport,
} from "../exportEmbeds.js";
import {
  isEquationDir,
  isFigureDir,
  isTableDir,
  isUnitDir,
  orderedChildren,
  readIndexData,
  resolveChildPath,
} from "../modelFs.js";

function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function shouldIncludeUnit(status: string, includeDrafts: boolean): boolean {
  if (includeDrafts) return true;
  return status === "approved";
}

function stripDuplicateLeadingH1(draft: string, title: string): string {
  let trimmed = draft.trim();
  const normalizedTitle = titleCase(title).toLowerCase();
  const headingLine = /^#{1,6}\s+(.+?)\s*$/m;
  while (true) {
    const match = trimmed.match(headingLine);
    if (!match || match[1].trim().toLowerCase() !== normalizedTitle) break;
    trimmed = trimmed.replace(/^#{1,6}\s+.+?\r?\n?/m, "").trim();
  }
  return trimmed;
}

function shouldEmitSectionHeading(data: Record<string, unknown>): boolean {
  const kind = String(data.kind ?? "").toLowerCase();
  if (kind === "unit" || kind === "figure" || kind === "table" || kind === "equation") {
    return false;
  }
  return kind === "section" || kind === "subsection" || kind === "paper" || kind === "";
}

function headingMarkdown(depth: number, title: string): string {
  const level = Math.min(Math.max(depth + 1, 2), 6);
  return `${"#".repeat(level)} ${title}\n\n`;
}

async function readEquationExportBody(modelRoot: string, dirRel: string): Promise<string | null> {
  const meta = await resolveEquationMetadata(modelRoot, dirRel);
  if (!meta) return null;
  const latex = await buildEquationLatexExportAsync(modelRoot, meta);
  return latex.trim() ? latex : null;
}

async function readFigureExportBody(modelRoot: string, dirRel: string): Promise<string | null> {
  const meta = await resolveFigureMetadata(modelRoot, dirRel);
  if (!meta) return null;
  const { latex } = buildFigureLatexExport(meta);
  return latex.trim() ? latex : null;
}

async function readTableExportBody(modelRoot: string, dirRel: string): Promise<string | null> {
  const meta = await resolveTableMetadata(modelRoot, dirRel);
  if (!meta) return null;
  const body = await buildTableMarkdownExport(modelRoot, meta);
  return body.trim() ? body : null;
}

async function readUnitExportBody(
  modelRoot: string,
  dirRel: string,
  includeDrafts: boolean,
  includeUnitOutlines: boolean,
  unitTitle: string,
): Promise<string | null> {
  const draftAbs = path.join(modelRoot, dirRel, "draft.md");
  if (existsSync(draftAbs)) {
    const draftRaw = (await readFile(draftAbs, "utf8")).trim();
    if (draftRaw) {
      const draft = stripDuplicateLeadingH1(draftRaw, unitTitle);
      if (draft) return draft;
    }
  }

  if (!includeDrafts || !includeUnitOutlines) return null;

  const outlineAbs = path.join(modelRoot, dirRel, "outline.md");
  if (!existsSync(outlineAbs)) return null;
  const outlineRaw = (await readFile(outlineAbs, "utf8")).trim();
  if (!outlineRaw) return null;
  return stripDuplicateLeadingH1(outlineRaw, unitTitle);
}

export async function countUnitSources(
  modelRoot: string,
  paperRel: string,
  includeDrafts: boolean,
): Promise<{ units: number; withDraft: number; withOutlineOnly: number }> {
  let units = 0;
  let withDraft = 0;
  let withOutlineOnly = 0;

  async function walk(dirRel: string): Promise<void> {
    if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) return;

    if (await isUnitDir(modelRoot, dirRel)) {
      units += 1;
      const data = await readIndexData(modelRoot, dirRel);
      const status = String(data.status ?? "outline");
      if (!shouldIncludeUnit(status, includeDrafts)) return;

      const draftAbs = path.join(modelRoot, dirRel, "draft.md");
      const hasDraft = existsSync(draftAbs) && (await readFile(draftAbs, "utf8")).trim().length > 0;
      if (hasDraft) {
        withDraft += 1;
        return;
      }

      const outlineAbs = path.join(modelRoot, dirRel, "outline.md");
      const hasOutline =
        includeDrafts && existsSync(outlineAbs) && (await readFile(outlineAbs, "utf8")).trim().length > 0;
      if (hasOutline) withOutlineOnly += 1;
      return;
    }

    for (const child of await orderedChildren(modelRoot, dirRel)) {
      const childRel = resolveChildPath(modelRoot, dirRel, child);
      if (childRel) await walk(childRel);
    }
  }

  await walk(paperRel);
  return { units, withDraft, withOutlineOnly };
}

export type ExportWalkOptions = {
  /** When false, unit outline.md is never used as fallback body content. */
  includeUnitOutlines?: boolean;
};

async function walkPaper(
  modelRoot: string,
  dirRel: string,
  depth: number,
  includeDrafts: boolean,
  parts: string[],
  walkOptions: ExportWalkOptions = {},
): Promise<number> {
  const includeUnitOutlines = walkOptions.includeUnitOutlines ?? true;
  if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) return 0;

  if (await isFigureDir(modelRoot, dirRel)) {
    const data = await readIndexData(modelRoot, dirRel);
    const status = String(data.status ?? "outline");
    if (!shouldIncludeUnit(status, includeDrafts)) return 0;
    const body = await readFigureExportBody(modelRoot, dirRel);
    if (!body) return 0;
    parts.push(`${body}\n\n`);
    return 1;
  }

  if (await isEquationDir(modelRoot, dirRel)) {
    const data = await readIndexData(modelRoot, dirRel);
    const status = String(data.status ?? "outline");
    if (!shouldIncludeUnit(status, includeDrafts)) return 0;
    const body = await readEquationExportBody(modelRoot, dirRel);
    if (!body) return 0;
    parts.push(`${body}\n\n`);
    return 1;
  }

  if (await isTableDir(modelRoot, dirRel)) {
    const data = await readIndexData(modelRoot, dirRel);
    const status = String(data.status ?? "outline");
    if (!shouldIncludeUnit(status, includeDrafts)) return 0;
    const body = await readTableExportBody(modelRoot, dirRel);
    if (!body) return 0;
    parts.push(`${body}\n\n`);
    return 1;
  }

  if (await isUnitDir(modelRoot, dirRel)) {
    const data = await readIndexData(modelRoot, dirRel);
    const status = String(data.status ?? "outline");
    if (!shouldIncludeUnit(status, includeDrafts)) return 0;

    const unitTitle = String(data.title ?? path.posix.basename(dirRel));
    const body = await readUnitExportBody(
      modelRoot,
      dirRel,
      includeDrafts,
      includeUnitOutlines,
      unitTitle,
    );
    if (!body) return 0;
    parts.push(`${body}\n\n`);
    return 1;
  }

  const data = await readIndexData(modelRoot, dirRel);
  const title = String(data.title ?? path.posix.basename(dirRel));
  const isSectionsContainer = path.posix.basename(dirRel) === "sections";

  const childParts: string[] = [];
  let count = 0;
  for (const child of await orderedChildren(modelRoot, dirRel)) {
    const childRel = resolveChildPath(modelRoot, dirRel, child);
    if (!childRel) continue;
    count += await walkPaper(modelRoot, childRel, depth + 1, includeDrafts, childParts, walkOptions);
  }
  if (count === 0) return 0;

  if (depth > 0 && !isSectionsContainer && shouldEmitSectionHeading(data)) {
    parts.push(headingMarkdown(depth, titleCase(title)));
  }
  parts.push(...childParts);
  return count;
}

/** Combine unit draft.md files in editorial order for pandoc export. */
export async function buildCombinedMarkdown(
  modelRoot: string,
  paperRel: string,
  includeDrafts: boolean,
): Promise<{ markdown: string; unitCount: number }> {
  const paperData = await readIndexData(modelRoot, paperRel);
  const title = String(paperData.title ?? path.posix.basename(paperRel));
  const parts: string[] = [`# ${title}\n\n`];
  const unitCount = await walkPaper(modelRoot, paperRel, 0, includeDrafts, parts);
  return { markdown: parts.join("").trim() + "\n", unitCount };
}

/** Combine units and nested subsections for one top-level section. */
export async function buildSectionMarkdown(
  modelRoot: string,
  sectionRel: string,
  sectionTitle: string,
  includeDrafts: boolean,
  walkOptions: ExportWalkOptions = {},
): Promise<{ markdown: string; unitCount: number }> {
  const parts: string[] = [`# ${sectionTitle}\n\n`];
  const unitCount = await walkPaper(modelRoot, sectionRel, 0, includeDrafts, parts, walkOptions);
  return { markdown: parts.join("").trim() + "\n", unitCount };
}

export function escapeLatexText(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}])/g, "\\$1")
    .replace(/([#%&_$])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

/** Read a top-level section outline.md for Overleaf planning notes. */
export async function readSectionOutlineNoteBody(
  modelRoot: string,
  sectionRel: string,
  sectionTitle: string,
): Promise<string | null> {
  const outlineAbs = path.join(modelRoot, sectionRel, "outline.md");
  if (!existsSync(outlineAbs)) return null;
  const outlineRaw = (await readFile(outlineAbs, "utf8")).trim();
  if (!outlineRaw) return null;
  return stripDuplicateLeadingH1(outlineRaw, sectionTitle);
}

/** Wrap section outline markdown as a raw LaTeX planning-note block for Overleaf export. */
export function formatSectionOutlineNoteForExport(outlineBody: string): string {
  const text = outlineBody
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[@([^\]]+)\]/g, (_full, cites: string) =>
      cites
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", "),
    )
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
  if (!text) return "";
  const escaped = escapeLatexText(text).replace(/\n{2,}/g, "\n\n\\par\n\n");
  return `\\begin{sectionoutline}\n${escaped}\n\\end{sectionoutline}\n\n`;
}

/** LaTeX preamble for section outline planning notes in modular Overleaf export. */
export function buildSectionOutlineNotePreamble(): string {
  return [
    "\\newenvironment{sectionoutline}{%",
    "  \\par\\smallskip\\noindent{\\color{teal!60!black}\\footnotesize\\itshape Section outline (planning notes)}%",
    "  \\par\\small\\begin{quote}",
    "}{%",
    "  \\end{quote}\\par\\smallskip",
    "}",
  ].join("\n");
}
