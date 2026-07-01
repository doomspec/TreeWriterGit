import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import matter from "gray-matter";

import { ModelFsError, resolvePaperRel } from "./modelFs.js";
import {
  buildCombinedMarkdown,
  buildSectionMarkdown,
  buildSectionOutlineNotePreamble,
  detectPdfEngine,
  formatSectionOutlineNoteForExport,
  readSectionOutlineNoteBody,
  type ExportFormat,
} from "./export.js";
import {
  buildFigureExportPreamble,
  expandManuscriptEmbedsForExport,
} from "./exportEmbeds.js";
import { listPaperFigures } from "./figures.js";
import {
  appendPandocExportStyleArgs,
  type JournalExportStyle,
} from "./journalExportStyle.js";
import { prepareMarkdownForLatexExport } from "./exportMarkdown.js";
import { validatePaperCrossRefs } from "./crossRefValidation.js";
import {
  buildNatureMainTexDocument,
  classifyNatureSectionSlugs,
  copyJournalTemplateBundle,
  usesNatureLatexTemplate,
} from "./exportNature.js";
import { listPaperSections, loadJournalTemplate } from "./papers.js";
import {
  assertExportAllowed,
  paperHasUnapprovedUnits,
  resolveExportBibliography,
  resolveExportHeader,
  writeStubFrontmatterFile,
} from "./export/runExportPipeline.js";
import type { ExportValidationConfig } from "@treewriter/shared";

const execFileAsync = promisify(execFile);

const CSL_REFERENCES_BLOCK =
  /\\protect\\phantomsection\\label\{refs\}[\s\S]*?\\end\{CSLReferences\}\s*/g;

export interface ModularExportBundle {
  /** Directory under repoRoot, e.g. `.treewriter-exports/vibecount-{stamp}` */
  bundleDir: string;
  mainTex: string;
  bibFile: string;
  sectionFiles: string[];
  assetFiles: string[];
  unitCount: number;
  missingCitations: string[];
  orphanCrossRefs: string[];
}

async function collectIncludegraphicsAssetPaths(
  modelRoot: string,
  paperRel: string,
  sources: string[],
): Promise<string[]> {
  const basenames = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
      basenames.add(match[1]!);
    }
  }
  if (basenames.size === 0) return [];

  const figures = await listPaperFigures(modelRoot, paperRel);
  const paths: string[] = [];
  for (const basename of basenames) {
    for (const figure of figures) {
      if (figure.previewPath && path.posix.basename(figure.previewPath) === basename) {
        if (!paths.includes(figure.previewPath)) paths.push(figure.previewPath);
      }
    }
  }
  return paths;
}

export async function copyExportAssetsToDir(
  modelRoot: string,
  bundleDir: string,
  assetPaths: string[],
): Promise<string[]> {
  const copied: string[] = [];
  for (const rel of assetPaths) {
    const source = path.join(modelRoot, rel);
    if (!existsSync(source)) continue;
    const dest = path.join(bundleDir, path.posix.basename(rel));
    await copyFile(source, dest);
    copied.push(path.posix.basename(rel));
  }
  return copied;
}

function stripBibliographyBlock(tex: string): string {
  return tex.replace(CSL_REFERENCES_BLOCK, "").trimEnd() + "\n";
}

function splitPandocStandaloneTex(tex: string): { preamble: string; bodyPrefix: string } {
  const beginMarker = "\\begin{document}";
  const beginIdx = tex.indexOf(beginMarker);
  if (beginIdx === -1) {
    throw new ModelFsError("Pandoc export did not produce a standalone LaTeX document", 500);
  }
  const preamble = tex.slice(0, beginIdx + beginMarker.length).trimEnd();
  const afterBegin = tex.slice(beginIdx + beginMarker.length);
  const cutPatterns = [/\\section\{/, /\\protect\\phantomsection\\label\{refs\}/, /\\begin\{CSLReferences\}/];
  let cutIdx = afterBegin.length;
  for (const pattern of cutPatterns) {
    const match = afterBegin.match(pattern);
    if (match?.index !== undefined && match.index < cutIdx) {
      cutIdx = match.index;
    }
  }
  const bodyPrefix = afterBegin.slice(0, cutIdx).trim();
  return { preamble, bodyPrefix };
}

function buildMainTexDocument(
  preambleWithBegin: string,
  bodyPrefix: string,
  sectionSlugs: string[],
): string {
  const inputs = sectionSlugs.map((slug) => `\\input{sections/${slug}}`).join("\n");
  const lines = [preambleWithBegin];
  if (bodyPrefix) lines.push("", bodyPrefix);
  lines.push("", inputs, "\\input{sections/references}", "", "\\end{document}", "");
  return lines.join("\n");
}

async function runPandocFragment(
  inputPath: string,
  outPath: string,
  bibliography: string,
  bibPath: string,
  cslPath: string | null,
  exportStyle: JournalExportStyle | undefined,
  headerPath?: string,
  format: ExportFormat = "latex",
  useBibtexStyle = false,
): Promise<void> {
  const pandocArgs = [
    inputPath,
    "--from=markdown+raw_tex+pipe_tables",
    `--to=${format === "pdf" ? "pdf" : "latex"}`,
    // Fragment (non-standalone) output is pandoc's default, so simply omit the
    // flag. Passing "--standalone=false" is rejected as an argument on pandoc
    // builds that treat --standalone as a pure boolean.
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

async function runPandocStandaloneStub(
  stubPath: string,
  outPath: string,
  exportStyle: JournalExportStyle | undefined,
  headerPath: string | undefined,
  bibliography: string,
  bibPath: string,
  cslPath: string | null,
): Promise<string> {
  const pandocArgs = [
    stubPath,
    "--from=markdown+raw_tex",
    "--to=latex",
    "--standalone",
    "--output",
    outPath,
  ];
  if (bibliography.trim()) {
    pandocArgs.push("--citeproc", "--bibliography", bibPath);
  }
  if (headerPath) {
    pandocArgs.push("--include-in-header", headerPath);
  }
  appendPandocExportStyleArgs(pandocArgs, exportStyle);
  if (cslPath) {
    pandocArgs.push("--csl", cslPath);
  }
  await execFileAsync("pandoc", pandocArgs);
  return readFile(outPath, "utf8");
}

async function exportBibliographyFragment(
  bundleDir: string,
  bibPath: string,
  cslPath: string | null,
  exportStyle: JournalExportStyle | undefined,
): Promise<string> {
  const refsMarkdownPath = path.join(bundleDir, "references.md");
  const refsTexPath = path.join(bundleDir, "sections", "references.tex");
  const frontmatter = {
    nocite: "@*\n",
    bibliography: path.basename(bibPath),
    "reference-section": true,
  };
  await writeFile(refsMarkdownPath, matter.stringify("", frontmatter), "utf8");
  await runPandocFragment(
    refsMarkdownPath,
    refsTexPath,
    await readFile(bibPath, "utf8"),
    bibPath,
    cslPath,
    exportStyle,
  );
  return refsTexPath;
}

/** Export one .tex file per top-level section plus main.tex wrapper and references.bib. */
export async function exportModularPaper(
  modelRoot: string,
  repoRoot: string,
  input: { paperSlug: string; includeDrafts?: boolean; validation?: ExportValidationConfig },
): Promise<ModularExportBundle> {
  const paperRel = resolvePaperRel(modelRoot, input.paperSlug);
  const paperIndex = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(paperIndex)) {
    throw new ModelFsError(`Paper not found: ${input.paperSlug}`, 404);
  }

  const includeDrafts = Boolean(input.includeDrafts);
  const paperData = matter(await readFile(paperIndex, "utf8")).data as Record<string, unknown>;
  const paperTitle = String(paperData.title ?? input.paperSlug);
  const journal = String(paperData.journal ?? "");

  let exportStyle: JournalExportStyle | undefined;
  try {
    const template = await loadJournalTemplate(modelRoot, journal);
    exportStyle = template.export;
  } catch {
    exportStyle = undefined;
  }
  const natureTemplate = usesNatureLatexTemplate(exportStyle);

  const { markdown: combinedRaw, unitCount } = await buildCombinedMarkdown(
    modelRoot,
    paperRel,
    includeDrafts,
  );
  if (unitCount === 0) {
    throw new ModelFsError("Nothing to export — no unit content found.", 400);
  }

  const bundleParent = path.join(repoRoot, ".treewriter-exports");
  const { bibliography, missingCitations, cslPath, useBibtexStyle } =
    await resolveExportBibliography(modelRoot, paperRel, combinedRaw, journal, exportStyle, bundleParent);
  const { orphanCrossRefs } = await validatePaperCrossRefs(modelRoot, paperRel, combinedRaw);
  assertExportAllowed(
    {
      orphanCrossRefs,
      missingCitations,
      hasUnapprovedUnits: await paperHasUnapprovedUnits(modelRoot, paperRel),
    },
    { ...(input.validation ?? {}), includeDrafts },
  );

  const combinedExpanded = await expandManuscriptEmbedsForExport(modelRoot, combinedRaw);
  const combined = await prepareMarkdownForLatexExport(combinedExpanded.markdown);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bundleName = `${input.paperSlug}-${stamp}`;
  const bundleDir = path.join(bundleParent, bundleName);
  const bibPath = path.join(bundleDir, "references.bib");
  const sectionsDir = path.join(bundleDir, "sections");
  await mkdir(sectionsDir, { recursive: true });
  if (bibliography) {
    await writeFile(bibPath, bibliography, "utf8");
  } else {
    await writeFile(bibPath, "", "utf8");
  }

  await writeFile(path.join(bundleDir, "combined.md"), combined, "utf8");

  const outlineNotesPreamble = buildSectionOutlineNotePreamble();
  const combinedHeader = await resolveExportHeader(
    modelRoot,
    combinedRaw,
    exportStyle,
    [outlineNotesPreamble, buildFigureExportPreamble()].filter(Boolean).join("\n\n"),
  );
  let headerPath: string | undefined;
  if (combinedHeader) {
    headerPath = path.join(bundleDir, "header.tex");
    await writeFile(headerPath, combinedHeader, "utf8");
  }

  const sectionSlugs: string[] = [];
  const sectionFiles: string[] = [];
  const exportAssetPaths = new Set<string>(combinedExpanded.assets);
  const sectionSourcesForAssets: string[] = [combined];

  for (const section of await listPaperSections(modelRoot, paperRel)) {
    if (!existsSync(path.join(modelRoot, section.path, "INDEX.md"))) continue;

    const { markdown: sectionRaw, unitCount: sectionUnits } = await buildSectionMarkdown(
      modelRoot,
      section.path,
      section.title,
      includeDrafts,
      { includeUnitOutlines: false },
    );

    const sectionOutline = await readSectionOutlineNoteBody(modelRoot, section.path, section.title);
    const sectionOutlineNote = sectionOutline ? formatSectionOutlineNoteForExport(sectionOutline) : "";
    if (sectionUnits === 0 && !sectionOutlineNote) continue;

    const sectionExpanded = await expandManuscriptEmbedsForExport(
      modelRoot,
      `${sectionOutlineNote}${sectionRaw}`,
    );
    for (const asset of sectionExpanded.assets) exportAssetPaths.add(asset);
    const sectionMarkdown = await prepareMarkdownForLatexExport(sectionExpanded.markdown);
    sectionSourcesForAssets.push(sectionMarkdown);
    const sectionMdPath = path.join(bundleDir, `${section.slug}.md`);
    const sectionTexPath = path.join(sectionsDir, `${section.slug}.tex`);
    await writeFile(sectionMdPath, sectionMarkdown, "utf8");

    await runPandocFragment(
      sectionMdPath,
      sectionTexPath,
      bibliography,
      bibPath,
      cslPath,
      exportStyle,
      headerPath,
      "latex",
      useBibtexStyle,
    );
    const fragment = stripBibliographyBlock(await readFile(sectionTexPath, "utf8"));
    await writeFile(sectionTexPath, fragment, "utf8");

    sectionSlugs.push(section.slug);
    sectionFiles.push(path.relative(repoRoot, sectionTexPath).split(path.sep).join("/"));
  }

  if (sectionSlugs.length === 0) {
    throw new ModelFsError("Nothing to export — no section content found.", 400);
  }

  for (const asset of await collectIncludegraphicsAssetPaths(modelRoot, paperRel, sectionSourcesForAssets)) {
    exportAssetPaths.add(asset);
  }

  const assetFiles = await copyExportAssetsToDir(modelRoot, bundleDir, [...exportAssetPaths]);

  if (bibliography.trim() && !useBibtexStyle) {
    const refsTexPath = await exportBibliographyFragment(
      bundleDir,
      bibPath,
      cslPath,
      exportStyle,
    );
    sectionFiles.push(path.relative(repoRoot, refsTexPath).split(path.sep).join("/"));
  } else if (!useBibtexStyle) {
    await writeFile(
      path.join(sectionsDir, "references.tex"),
      "% No references.bib entries\n",
      "utf8",
    );
    sectionFiles.push(
      path.relative(repoRoot, path.join(sectionsDir, "references.tex")).split(path.sep).join("/"),
    );
  }

  const mainTexPath = path.join(bundleDir, "main.tex");
  if (natureTemplate && exportStyle?.templateBundle) {
    await copyJournalTemplateBundle(modelRoot, exportStyle.templateBundle, bundleDir);
    const roles = classifyNatureSectionSlugs(sectionSlugs);
    const author = typeof paperData.author === "string" ? paperData.author : undefined;
    await writeFile(
      mainTexPath,
      buildNatureMainTexDocument({
        title: paperTitle,
        author,
        abstractSection: roles.abstract,
        bodySections: roles.body,
        methodsSection: roles.methods,
        supplementarySection: roles.supplementary,
        bibBaseName: "references",
      }),
      "utf8",
    );
  } else {
    const stubPath = await writeStubFrontmatterFile(bundleDir, paperTitle, bibliography, bibPath);
    const stubTexPath = path.join(bundleDir, "stub.tex");
    const stubTex = await runPandocStandaloneStub(
      stubPath,
      stubTexPath,
      exportStyle,
      headerPath,
      bibliography,
      bibPath,
      cslPath,
    );
    const { preamble, bodyPrefix } = splitPandocStandaloneTex(stubTex);
    await writeFile(mainTexPath, buildMainTexDocument(preamble, bodyPrefix, sectionSlugs), "utf8");
  }

  const rel = (abs: string) => path.relative(repoRoot, abs).split(path.sep).join("/");

  return {
    bundleDir: rel(bundleDir),
    mainTex: rel(mainTexPath),
    bibFile: rel(bibPath),
    sectionFiles,
    assetFiles,
    unitCount,
    missingCitations,
    orphanCrossRefs,
  };
}

/** Copy all files from a modular export bundle into a target directory. */
export async function copyModularBundleToDir(
  repoRoot: string,
  bundle: ModularExportBundle,
  targetDir: string,
): Promise<string[]> {
  const bundleAbs = path.join(repoRoot, bundle.bundleDir);
  const copied: string[] = [];

  async function copyRelative(relPath: string): Promise<void> {
    const source = path.join(bundleAbs, relPath);
    const dest = path.join(targetDir, relPath);
    if (!existsSync(source)) return;
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(source, dest);
    copied.push(relPath);
  }

  await copyRelative("main.tex");
  await copyRelative("references.bib");

  const sectionsAbs = path.join(bundleAbs, "sections");
  if (existsSync(sectionsAbs)) {
    for (const file of await readdir(sectionsAbs)) {
      if (file.endsWith(".tex")) {
        await copyRelative(path.posix.join("sections", file));
      }
    }
  }

  for (const file of await readdir(bundleAbs)) {
    if (/\.(png|jpe?g|pdf|svg|webp|gif|cls|bst|sty|tex)$/i.test(file)) {
      await copyRelative(file);
    }
  }

  return copied;
}
