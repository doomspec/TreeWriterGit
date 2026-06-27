import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import matter from "gray-matter";

import { approveDraftTarget } from "./draftApproval/workflow.js";
import {
  parseMarkdownImportStructure,
  uniqueImportSlug,
  type DocxImportSection,
} from "./docxImportParse.js";
import {
  createNode,
  ModelFsError,
  orderedChildren,
  PAPER_ASSET_DIRS,
  readIndexData,
  reorderChildren,
  resolveModelPath,
} from "./modelFs.js";

const execFileAsync = promisify(execFile);

export type DocxImportOptions = {
  approvedBy?: string | null;
  autoApprove?: boolean;
};

export type DocxImportResult = {
  sectionsCreated: number;
  unitsCreated: number;
  paths: string[];
  paperTitle?: string;
  notice?: string;
};

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

export async function convertDocxBufferToMarkdown(buffer: Buffer): Promise<string> {
  await assertPandocAvailable();
  const dir = await mkdtemp(path.join(tmpdir(), "tw-docx-import-"));
  const inputPath = path.join(dir, "input.docx");
  const outputPath = path.join(dir, "output.md");
  try {
    await writeFile(inputPath, buffer);
    await execFileAsync("pandoc", [
      inputPath,
      "-t",
      "gfm",
      "--wrap=none",
      "-o",
      outputPath,
    ]);
    return (await readFile(outputPath, "utf8")).trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function importSectionUnits(
  modelRoot: string,
  sectionRel: string,
  section: DocxImportSection,
  options: DocxImportOptions,
): Promise<{ unitsCreated: number; paths: string[] }> {
  const usedUnitSlugs = new Set(await orderedChildren(modelRoot, sectionRel));
  const unitSlugs: string[] = [];
  const paths: string[] = [];
  let unitsCreated = 0;

  for (const unit of section.units) {
    const unitSlug = uniqueImportSlug(unit.title, usedUnitSlugs);
    const unitRel = await createNode(modelRoot, sectionRel, unitSlug, "unit");
    const draftRel = `${unitRel}/draft.md`;
    await writeFile(path.join(modelRoot, draftRel), `${unit.body.trim()}\n`, "utf8");
    if (options.autoApprove !== false) {
      await approveDraftTarget(
        modelRoot,
        draftRel,
        options.approvedBy ?? "docx-import",
      );
    }
    unitSlugs.push(unitSlug);
    paths.push(unitRel, draftRel);
    unitsCreated += 1;
  }

  if (unitSlugs.length > 0) {
    await reorderChildren(modelRoot, sectionRel, unitSlugs);
  }

  return { unitsCreated, paths };
}

export async function importDocxIntoPaper(
  modelRoot: string,
  paperSlug: string,
  docxBuffer: Buffer,
  options: DocxImportOptions = {},
): Promise<DocxImportResult> {
  if (!paperSlug.trim()) {
    throw new ModelFsError("paperSlug required", 400);
  }
  if (docxBuffer.length === 0) {
    throw new ModelFsError("Empty DOCX file", 400);
  }
  if (docxBuffer.length > 25 * 1024 * 1024) {
    throw new ModelFsError("File too large (max 25MB)", 400);
  }

  const markdown = await convertDocxBufferToMarkdown(docxBuffer);
  return importMarkdownIntoPaper(modelRoot, paperSlug, markdown, options);
}

export async function importMarkdownIntoPaper(
  modelRoot: string,
  paperSlug: string,
  markdown: string,
  options: DocxImportOptions = {},
): Promise<DocxImportResult> {
  if (!paperSlug.trim()) {
    throw new ModelFsError("paperSlug required", 400);
  }

  const paperRel = `papers/${paperSlug.trim()}`;
  resolveModelPath(modelRoot, paperRel);
  if (!existsSync(path.join(modelRoot, paperRel, "INDEX.md"))) {
    throw new ModelFsError(`Paper not found: ${paperRel}`, 404);
  }

  const parsed = parseMarkdownImportStructure(markdown);
  if (parsed.sections.length === 0) {
    throw new ModelFsError("No importable sections found in the Word document", 400);
  }

  const usedSectionSlugs = new Set(await orderedChildren(modelRoot, paperRel));
  const paperData = await readIndexData(modelRoot, paperRel);
  const existingOrder = Array.isArray(paperData.section_order)
    ? (paperData.section_order as string[]).filter((name) => !PAPER_ASSET_DIRS.has(name))
    : [];

  const createdSectionSlugs: string[] = [];
  const paths: string[] = [];
  let sectionsCreated = 0;
  let unitsCreated = 0;

  for (const section of parsed.sections) {
    const sectionSlug = uniqueImportSlug(section.title, usedSectionSlugs);
    const sectionRel = await createNode(modelRoot, paperRel, sectionSlug, "section");
    createdSectionSlugs.push(sectionSlug);
    paths.push(sectionRel);
    sectionsCreated += 1;

    const unitResult = await importSectionUnits(modelRoot, sectionRel, section, options);
    unitsCreated += unitResult.unitsCreated;
    paths.push(...unitResult.paths);
  }

  const nextOrder = [...existingOrder];
  for (const slug of createdSectionSlugs) {
    if (!nextOrder.includes(slug)) nextOrder.push(slug);
  }
  await reorderChildren(modelRoot, paperRel, nextOrder);

  if (parsed.paperTitle) {
    const indexAbs = path.join(modelRoot, paperRel, "INDEX.md");
    const parsedIndex = matter(await readFile(indexAbs, "utf8"));
    const data = parsedIndex.data as Record<string, unknown>;
    await writeFile(
      indexAbs,
      matter.stringify(parsedIndex.content, { ...data, title: parsed.paperTitle }),
      "utf8",
    );
    paths.push(`${paperRel}/INDEX.md`);
  }

  return {
    sectionsCreated,
    unitsCreated,
    paths: [...new Set(paths)],
    paperTitle: parsed.paperTitle,
    notice:
      unitsCreated === 0
        ? "Sections were created but no unit paragraphs were detected."
        : undefined,
  };
}
