import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import matter from "gray-matter";

import { copyJournalTemplateBundle } from "../exportNature.js";
import {
  appendPandocExportStyleArgs,
  type JournalExportStyle,
} from "../journalExportStyle.js";
import { prepareMarkdownForLatexExport } from "../exportMarkdown.js";
import { validatePaperCrossRefs } from "../crossRefValidation.js";
import { ModelFsError, readIndexData, resolvePaperRel } from "../modelFs.js";
import { loadJournalTemplate } from "../papers.js";
import { buildCombinedMarkdown, countUnitSources } from "./assembly.js";
import { resolveCslPath } from "./bibliography.js";
import type { ExportFormat, ExportPaperInput, ExportPaperResult } from "./types.js";
import {
  assertExportAllowed,
  paperHasUnapprovedUnits,
  resolveExportBibliography,
  resolveExportHeader,
} from "./runExportPipeline.js";

const execFileAsync = promisify(execFile);

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
  exportStyle: JournalExportStyle | undefined,
  headerPath?: string,
  useBibtexStyle = false,
): Promise<void> {
  const pandocArgs = [
    combinedPath,
    "--from=markdown+raw_tex+pipe_tables",
    `--to=${format === "pdf" ? "pdf" : "latex"}`,
    "--output",
    outPath,
  ];
  if (headerPath) {
    pandocArgs.push("--include-in-header", headerPath);
  }
  appendPandocExportStyleArgs(pandocArgs, exportStyle);
  if (bibliography) {
    pandocArgs.push("--bibliography", bibPath);
  }
  if (!useBibtexStyle) {
    pandocArgs.push("--citeproc");
    if (cslPath) {
      pandocArgs.push("--csl", cslPath);
    }
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

export async function patchLastExport(modelRoot: string, paperRel: string): Promise<void> {
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
  if (input.format === "docx") {
    const { exportPaperDocx } = await import("../exportDocx.js");
    return exportPaperDocx(modelRoot, repoRoot, input);
  }

  const paperRel = resolvePaperRel(modelRoot, input.paperSlug);
  const paperIndex = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(paperIndex)) {
    throw new ModelFsError(`Paper not found: ${input.paperSlug}`, 404);
  }

  await assertPandocAvailable();

  const paperData = await readIndexData(modelRoot, paperRel);
  const journal = String(paperData.journal ?? "");
  let exportStyle: JournalExportStyle | undefined;
  try {
    const template = await loadJournalTemplate(modelRoot, journal);
    exportStyle = template.export;
  } catch {
    exportStyle = undefined;
  }
  const cslPath = resolveCslPath(modelRoot, journal, exportStyle?.csl);

  const includeDrafts = Boolean(input.includeDrafts);
  const { markdown: combinedRaw, unitCount } = await buildCombinedMarkdown(
    modelRoot,
    paperRel,
    includeDrafts,
  );
  const combined = await prepareMarkdownForLatexExport(combinedRaw);
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

  const { bibliography, missingCitations, useBibtexStyle } =
    await resolveExportBibliography(modelRoot, paperRel, combined, journal, exportStyle, exportDir);
  const { orphanCrossRefs } = await validatePaperCrossRefs(modelRoot, paperRel, combinedRaw);
  assertExportAllowed(
    {
      orphanCrossRefs,
      missingCitations,
      hasUnapprovedUnits: await paperHasUnapprovedUnits(modelRoot, paperRel),
    },
    { ...(input.validation ?? {}), includeDrafts },
  );

  await mkdir(exportDir, { recursive: true });

  if (exportStyle?.templateBundle) {
    await copyJournalTemplateBundle(modelRoot, exportStyle.templateBundle, exportDir);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${input.paperSlug}-${stamp}`;
  const combinedPath = path.join(exportDir, `${baseName}.md`);
  const bibPath = path.join(exportDir, `${baseName}.bib`);
  const outExt = input.format === "pdf" ? "pdf" : "tex";
  const outPath = path.join(exportDir, `${baseName}.${outExt}`);

  await writeFile(combinedPath, combined, "utf8");
  if (bibliography) {
    await writeFile(bibPath, bibliography, "utf8");
  }

  const combinedHeader = await resolveExportHeader(modelRoot, combinedRaw, exportStyle);
  let headerPath: string | undefined;
  if (combinedHeader) {
    headerPath = path.join(exportDir, `${baseName}-header.tex`);
    await writeFile(headerPath, combinedHeader, "utf8");
  }

  let effectiveFormat = input.format;
  let notice: string | undefined;

  const tryExport = async (format: ExportFormat, outFile: string) => {
    await runPandocExport(
      combinedPath,
      outFile,
      format,
      bibliography,
      bibPath,
      cslPath,
      exportStyle,
      headerPath,
      useBibtexStyle,
    );
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
    ...(orphanCrossRefs.length > 0 ? { orphanCrossRefs } : {}),
    ...(cslPath ? { cslPath: path.relative(modelRoot, cslPath).split(path.sep).join("/") } : {}),
  };
}

export async function exportPaperBatch(
  modelRoot: string,
  repoRoot: string,
  input: {
    paperSlug: string;
    formats: ExportFormat[];
    includeDrafts?: boolean;
    validation?: ExportPaperInput["validation"];
  },
): Promise<ExportPaperResult[]> {
  const formats = input.formats.length > 0 ? input.formats : (["latex"] as ExportFormat[]);
  const results: ExportPaperResult[] = [];
  for (const format of formats) {
    results.push(
      await exportPaper(modelRoot, repoRoot, {
        paperSlug: input.paperSlug,
        format,
        includeDrafts: input.includeDrafts,
        validation: input.validation,
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
