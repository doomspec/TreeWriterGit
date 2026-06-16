import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import matter from "gray-matter";

import { ModelFsError } from "./modelFs.js";

const execFileAsync = promisify(execFile);

export type ExportFormat = "latex" | "pdf";

export interface ExportPaperInput {
  paperSlug: string;
  format: ExportFormat;
  includeDrafts?: boolean;
}

export interface ExportPaperResult {
  path: string;
  downloadUrl: string;
  format: ExportFormat;
}

const SKIP_CHILDREN = new Set(["notes", ".sessions"]);

function resolveChildPath(modelRoot: string, parentRel: string, childName: string): string | null {
  const direct = `${parentRel}/${childName}`;
  if (existsSync(path.join(modelRoot, direct))) return direct;
  const underSections = `${parentRel}/sections/${childName}`;
  if (existsSync(path.join(modelRoot, underSections))) return underSections;
  return null;
}

function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function readIndexData(modelRoot: string, relPath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(modelRoot, relPath, "INDEX.md"), "utf8");
    return matter(raw).data as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function isUnitDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "unit") return true;
  if (data.kind === "section" || data.kind === "subsection" || data.kind === "paper") {
    return false;
  }
  return existsSync(path.join(modelRoot, relPath, "draft.md"));
}

function shouldIncludeUnit(status: string, includeDrafts: boolean): boolean {
  if (includeDrafts) return true;
  return status === "approved";
}

function headingMarkdown(depth: number, title: string): string {
  const level = Math.min(Math.max(depth + 1, 2), 6);
  return `${"#".repeat(level)} ${title}\n\n`;
}

/** Extract pandoc cite keys from `[@a, b]` and bare `@key` tokens. */
export function extractCiteKeys(markdown: string): string[] {
  const keys = new Set<string>();
  for (const match of markdown.matchAll(/\[@([^\]]+)\]/g)) {
    for (const part of match[1].split(/[,;]/)) {
      const key = part.trim().replace(/^@/, "");
      if (key) keys.add(key);
    }
  }
  for (const match of markdown.matchAll(/(?<![\w/@])@([a-zA-Z][\w-]+)/g)) {
    keys.add(match[1]);
  }
  return [...keys].sort();
}

function bibEntryFromNote(citeKey: string, data: Record<string, unknown>, body: string): string {
  const title =
    String(data.title ?? "").trim() ||
    body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ||
    citeKey;
  const authors = String(data.authors ?? "Unknown");
  const year = String(data.year ?? "n.d.");
  const journal = String(data.journal ?? "");
  const doi = String(data.doi ?? "");

  const lines = [
    `@article{${citeKey},`,
    `  title={${title.replace(/[{}]/g, "")}},`,
    `  author={${authors.replace(/[{}]/g, "")}},`,
    `  year={${year}},`,
  ];
  if (journal) lines.push(`  journal={${journal.replace(/[{}]/g, "")}},`);
  if (doi) lines.push(`  doi={${doi}},`);
  lines.push("}");
  return lines.join("\n");
}

/** Build a .bib file from literature notes for the keys referenced in the export. */
export async function buildBibliography(
  modelRoot: string,
  paperRel: string,
  combinedMarkdown: string,
): Promise<string> {
  const wanted = new Set(extractCiteKeys(combinedMarkdown));
  if (wanted.size === 0) return "";

  const literatureDir = path.join(modelRoot, paperRel, "notes", "literature");
  if (!existsSync(literatureDir)) return "";

  const entries: string[] = [];
  for (const file of await readdir(literatureDir)) {
    if (!file.endsWith(".md")) continue;
    const raw = await readFile(path.join(literatureDir, file), "utf8");
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const citeKey = String(data.cite_key ?? file.replace(/\.md$/, ""));
    if (!wanted.has(citeKey)) continue;
    entries.push(bibEntryFromNote(citeKey, data, parsed.content));
  }

  return entries.join("\n\n");
}

async function orderedChildren(modelRoot: string, dirRel: string): Promise<string[]> {
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

  // Append any on-disk children not listed in order (except skipped).
  try {
    const entries = await readdir(path.join(modelRoot, dirRel), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_CHILDREN.has(entry.name) || seen.has(entry.name)) continue;
      if (entry.name === "sections" && order.length > 0) continue;
      result.push(entry.name);
    }
  } catch {
    // ignore
  }

  return result;
}

async function walkPaper(
  modelRoot: string,
  dirRel: string,
  depth: number,
  includeDrafts: boolean,
  parts: string[],
): Promise<number> {
  if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) return 0;

  if (await isUnitDir(modelRoot, dirRel)) {
    const data = await readIndexData(modelRoot, dirRel);
    const status = String(data.status ?? "outline");
    if (!shouldIncludeUnit(status, includeDrafts)) return 0;

    const draftAbs = path.join(modelRoot, dirRel, "draft.md");
    if (!existsSync(draftAbs)) return 0;
    const draft = (await readFile(draftAbs, "utf8")).trim();
    if (!draft) return 0;
    parts.push(`${draft}\n\n`);
    return 1;
  }

  const data = await readIndexData(modelRoot, dirRel);
  const title = String(data.title ?? path.posix.basename(dirRel));
  const isSectionsContainer = path.posix.basename(dirRel) === "sections";
  if (depth > 0 && !isSectionsContainer) {
    parts.push(headingMarkdown(depth, titleCase(title)));
  }

  let count = 0;
  for (const child of await orderedChildren(modelRoot, dirRel)) {
    const childRel = resolveChildPath(modelRoot, dirRel, child);
    if (!childRel) continue;
    count += await walkPaper(modelRoot, childRel, depth + 1, includeDrafts, parts);
  }
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

async function assertPandocAvailable(): Promise<void> {
  try {
    await execFileAsync("pandoc", ["--version"]);
  } catch {
    throw new ModelFsError(
      "pandoc is not installed. Install it with: brew install pandoc (PDF export also needs MacTeX or another LaTeX engine).",
      503,
    );
  }
}

async function patchLastExport(modelRoot: string, paperRel: string): Promise<void> {
  const indexAbs = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexAbs)) return;
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const data = { ...parsed.data, last_export: new Date().toISOString() };
  await writeFile(indexAbs, matter.stringify(parsed.content, data), "utf8");
}

export async function exportPaper(
  modelRoot: string,
  repoRoot: string,
  input: ExportPaperInput,
): Promise<ExportPaperResult> {
  const paperRel = `papers/${input.paperSlug.trim()}`;
  const paperIndex = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(paperIndex)) {
    throw new ModelFsError(`Paper not found: ${input.paperSlug}`, 404);
  }

  await assertPandocAvailable();

  const includeDrafts = Boolean(input.includeDrafts);
  const { markdown: combined, unitCount } = await buildCombinedMarkdown(
    modelRoot,
    paperRel,
    includeDrafts,
  );
  if (unitCount === 0) {
    throw new ModelFsError(
      includeDrafts
        ? "Nothing to export — no unit draft.md files with content."
        : "Nothing to export — no units with status: approved. Try includeDrafts: true.",
      400,
    );
  }

  const exportDir = path.join(repoRoot, ".treewriter-exports");
  await mkdir(exportDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${input.paperSlug}-${stamp}`;
  const combinedPath = path.join(exportDir, `${baseName}.md`);
  const bibPath = path.join(exportDir, `${baseName}.bib`);
  const outExt = input.format === "pdf" ? "pdf" : "tex";
  const outPath = path.join(exportDir, `${baseName}.${outExt}`);

  await writeFile(combinedPath, combined, "utf8");

  const bibliography = await buildBibliography(modelRoot, paperRel, combined);
  if (bibliography) {
    await writeFile(bibPath, bibliography, "utf8");
  }

  const pandocArgs = [
    combinedPath,
    "--from=markdown",
    `--to=${input.format === "pdf" ? "pdf" : "latex"}`,
    "--citeproc",
    "--output",
    outPath,
  ];
  if (bibliography) {
    pandocArgs.push("--bibliography", bibPath);
  }

  try {
    await execFileAsync("pandoc", pandocArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (input.format === "pdf" && /pdflatex|xelatex|lualatex|not found/i.test(message)) {
      throw new ModelFsError(
        "PDF export requires a LaTeX engine. Install MacTeX or export as LaTeX (.tex) instead.",
        503,
      );
    }
    throw new ModelFsError(`pandoc export failed: ${message}`, 500);
  }

  await patchLastExport(modelRoot, paperRel);

  const fileName = `${baseName}.${outExt}`;
  return {
    path: path.relative(repoRoot, outPath).split(path.sep).join("/"),
    downloadUrl: `/api/export/download?file=${encodeURIComponent(fileName)}`,
    format: input.format,
  };
}

export function resolveExportDownload(repoRoot: string, fileName: string): string {
  const safeName = path.basename(fileName);
  if (!safeName || safeName !== fileName) {
    throw new ModelFsError("Invalid export file name", 400);
  }
  const abs = path.join(repoRoot, ".treewriter-exports", safeName);
  if (!abs.startsWith(path.join(repoRoot, ".treewriter-exports"))) {
    throw new ModelFsError("Invalid export path", 400);
  }
  if (!existsSync(abs)) {
    throw new ModelFsError(`Export file not found: ${safeName}`, 404);
  }
  return abs;
}
