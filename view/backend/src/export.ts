import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import matter from "gray-matter";

import { ModelFsError, isUnitDir, orderedChildren, readIndexData, resolveChildPath } from "./modelFs.js";

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
  /** Set when PDF was requested but .tex was produced instead (no LaTeX engine). */
  notice?: string;
  /** Cite keys referenced in markdown but absent from generated .bib */
  missingCitations?: string[];
  /** CSL file used, if any */
  cslPath?: string;
}

function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function shouldIncludeUnit(status: string, includeDrafts: boolean): boolean {
  if (includeDrafts) return true;
  return status === "approved";
}

function stripDuplicateLeadingH1(draft: string, title: string): string {
  const trimmed = draft.trim();
  const normalizedTitle = titleCase(title).toLowerCase();
  const match = trimmed.match(/^#\s+(.+?)\s*$/m);
  if (match && match[1].trim().toLowerCase() === normalizedTitle) {
    return trimmed.replace(/^#\s+.+?\r?\n?/, "").trim();
  }
  return trimmed;
}

function journalSlug(journal: string): string {
  return journal
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Resolve optional CSL from paper journal → model/templates/{slug}.csl */
export function resolveCslPath(modelRoot: string, journal: string): string | null {
  const slug = journalSlug(journal);
  if (!slug) return null;
  const candidates = [
    path.join(modelRoot, "templates", `${slug}.csl`),
    path.join(modelRoot, "shared", `${slug}.csl`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
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

/** Cite keys in markdown that have no matching @entry in the generated bibliography. */
export function findMissingCitations(combinedMarkdown: string, bibliography: string): string[] {
  const wanted = extractCiteKeys(combinedMarkdown);
  if (!bibliography.trim()) return wanted;
  const inBib = new Set<string>();
  for (const match of bibliography.matchAll(/@\w+\{([^,\s]+)/g)) {
    inBib.add(match[1]);
  }
  return wanted.filter((key) => !inBib.has(key));
}

async function readUnitExportBody(
  modelRoot: string,
  dirRel: string,
  includeDrafts: boolean,
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

  if (!includeDrafts) return null;

  const outlineAbs = path.join(modelRoot, dirRel, "outline.md");
  if (!existsSync(outlineAbs)) return null;
  const outlineRaw = (await readFile(outlineAbs, "utf8")).trim();
  if (!outlineRaw) return null;
  return stripDuplicateLeadingH1(outlineRaw, unitTitle);
}

async function countUnitSources(
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

    const unitTitle = String(data.title ?? path.posix.basename(dirRel));
    const body = await readUnitExportBody(modelRoot, dirRel, includeDrafts, unitTitle);
    if (!body) return 0;
    parts.push(`${body}\n\n`);
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
      "pandoc is not installed. Install it with: brew install pandoc",
      503,
    );
  }
}

const PDF_ENGINES = ["tectonic", "xelatex", "pdflatex", "lualatex"] as const;

/** First PDF engine on PATH, preferring lightweight tectonic over full MacTeX. */
export async function detectPdfEngine(): Promise<string | null> {
  for (const engine of PDF_ENGINES) {
    try {
      await execFileAsync("which", [engine]);
      return engine;
    } catch {
      // try next
    }
  }
  return null;
}

async function runPandocExport(
  combinedPath: string,
  outPath: string,
  format: ExportFormat,
  bibliography: string,
  bibPath: string,
  cslPath: string | null,
): Promise<void> {
  const pandocArgs = [
    combinedPath,
    "--from=markdown",
    `--to=${format === "pdf" ? "pdf" : "latex"}`,
    "--citeproc",
    "--output",
    outPath,
  ];
  if (bibliography) {
    pandocArgs.push("--bibliography", bibPath);
  }
  if (cslPath) {
    pandocArgs.push("--csl", cslPath);
  }
  if (format === "pdf") {
    const engine = await detectPdfEngine();
    if (!engine) {
      throw new ModelFsError("NO_PDF_ENGINE", 503);
    }
    pandocArgs.push("--pdf-engine", engine);
  }
  await execFileAsync("pandoc", pandocArgs);
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

  const paperData = await readIndexData(modelRoot, paperRel);
  const cslPath = resolveCslPath(modelRoot, String(paperData.journal ?? ""));

  const includeDrafts = Boolean(input.includeDrafts);
  const { markdown: combined, unitCount } = await buildCombinedMarkdown(
    modelRoot,
    paperRel,
    includeDrafts,
  );
  if (unitCount === 0) {
    const stats = await countUnitSources(modelRoot, paperRel, includeDrafts);
    const message = includeDrafts
      ? stats.units === 0
        ? "Nothing to export — no units found in this paper."
        : stats.withDraft === 0 && stats.withOutlineOnly === 0
          ? `Nothing to export — ${stats.units} unit${stats.units === 1 ? "" : "s"} found but no draft.md or outline.md content.`
          : "Nothing to export — no unit draft.md files with content."
      : stats.withDraft > 0
        ? `Nothing to export — ${stats.withDraft} draft${stats.withDraft === 1 ? "" : "s"} exist but none are approved. Enable "Include non-approved drafts".`
        : "Nothing to export — no units with status: approved. Enable \"Include non-approved drafts\" to export outlines.";
    throw new ModelFsError(message, 400);
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
  const missingCitations = findMissingCitations(combined, bibliography);
  if (bibliography) {
    await writeFile(bibPath, bibliography, "utf8");
  }

  let effectiveFormat = input.format;
  let notice: string | undefined;

  const tryExport = async (format: ExportFormat, outFile: string) => {
    await runPandocExport(combinedPath, outFile, format, bibliography, bibPath, cslPath);
  };

  try {
    await tryExport(input.format, outPath);
  } catch (error) {
    if (
      input.format === "pdf" &&
      error instanceof ModelFsError &&
      (error.message === "NO_PDF_ENGINE" ||
        /pdflatex|xelatex|lualatex|tectonic|not found/i.test(error.message))
    ) {
      const texPath = path.join(exportDir, `${baseName}.tex`);
      effectiveFormat = "latex";
      await tryExport("latex", texPath);
      notice =
        "No LaTeX PDF engine found — downloaded .tex instead. For PDF: brew install tectonic (smaller) or brew install --cask mactex";
    } else if (error instanceof ModelFsError) {
      throw error;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelFsError(`pandoc export failed: ${message}`, 500);
    }
  }

  await patchLastExport(modelRoot, paperRel);

  const fileName = `${baseName}.${effectiveFormat === "pdf" ? "pdf" : "tex"}`;
  return {
    path: path.relative(repoRoot, path.join(exportDir, fileName)).split(path.sep).join("/"),
    downloadUrl: `/api/export/download?file=${encodeURIComponent(fileName)}`,
    format: effectiveFormat,
    notice,
    ...(missingCitations.length > 0 ? { missingCitations } : {}),
    ...(cslPath ? { cslPath: path.relative(modelRoot, cslPath).split(path.sep).join("/") } : {}),
  };
}

export async function exportPaperBatch(
  modelRoot: string,
  repoRoot: string,
  input: { paperSlug: string; formats: ExportFormat[]; includeDrafts?: boolean },
): Promise<ExportPaperResult[]> {
  const formats = input.formats.length > 0 ? input.formats : (["latex"] as ExportFormat[]);
  const results: ExportPaperResult[] = [];
  for (const format of formats) {
    results.push(
      await exportPaper(modelRoot, repoRoot, {
        paperSlug: input.paperSlug,
        format,
        includeDrafts: input.includeDrafts,
      }),
    );
  }
  return results;
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
