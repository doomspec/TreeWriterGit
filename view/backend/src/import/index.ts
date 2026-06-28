import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import {
  createNode,
  ModelFsError,
  orderedChildren,
  readIndexData,
  reorderChildren,
  resolveModelPath,
} from "../modelFs.js";
import { parseMarkdownImportStructure, uniqueImportSlug } from "./parse.js";
import type {
  DocxImportOptions,
  DocxImportPreview,
  DocxImportPreviewNode,
  DocxImportResult,
  DocxImportTargetOption,
} from "./types.js";
import { convertDocxBufferToMarkdown } from "./convert.js";
import {
  buildExistingPreviewTree,
  containerKindForParent,
  listImportTargetOptions,
  parseImportPlan,
  planImportedPreviewTree,
  readContainerOrder,
  resolveImportParent,
} from "./plan.js";
import {
  clearContainerChildren,
  importFromPreviewPlan,
  importSectionTree,
} from "./apply.js";

export type {
  DocxImportOptions,
  DocxImportPreview,
  DocxImportPreviewNode,
  DocxImportResult,
  DocxImportTargetOption,
} from "./types.js";
export { convertDocxBufferToMarkdown } from "./convert.js";
export { parseImportPlan } from "./plan.js";
export async function previewMarkdownImport(
  modelRoot: string,
  paperSlug: string,
  markdown: string,
  options: Pick<DocxImportOptions, "targetSection" | "replaceTarget"> = {},
): Promise<DocxImportPreview> {
  if (!paperSlug.trim()) {
    throw new ModelFsError("paperSlug required", 400);
  }

  const { paperRel, importParentRel, importTargetSlug } = resolveImportParent(
    modelRoot,
    paperSlug,
    options.targetSection,
  );
  const parsed = parseMarkdownImportStructure(markdown);
  if (parsed.sections.length === 0) {
    throw new ModelFsError("No importable sections found in the Word document", 400);
  }

  const importParentData = await readIndexData(modelRoot, importParentRel);
  const containerKind = containerKindForParent(importParentData.kind);
  const existing = await buildExistingPreviewTree(modelRoot, importParentRel);
  const planned = planImportedPreviewTree(parsed, containerKind);
  const availableTargets = await listImportTargetOptions(modelRoot, paperRel);

  return {
    importTargetPath: importParentRel,
    importTargetSlug,
    importTargetTitle: String(importParentData.title ?? (importTargetSlug || paperSlug)),
    replaceExisting: options.replaceTarget !== false,
    importedPaperTitle: parsed.paperTitle,
    existing,
    imported: planned.nodes,
    sectionsCreated: planned.sectionsCreated,
    unitsCreated: planned.unitsCreated,
    availableTargets,
  };
}

export async function previewDocxImport(
  modelRoot: string,
  paperSlug: string,
  docxBuffer: Buffer,
  options: Pick<DocxImportOptions, "targetSection" | "replaceTarget"> = {},
): Promise<DocxImportPreview> {
  if (docxBuffer.length === 0) {
    throw new ModelFsError("Empty DOCX file", 400);
  }
  if (docxBuffer.length > 25 * 1024 * 1024) {
    throw new ModelFsError("File too large (max 25MB)", 400);
  }

  const markdown = await convertDocxBufferToMarkdown(docxBuffer);
  return previewMarkdownImport(modelRoot, paperSlug, markdown, options);
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

  const targetSection = options.targetSection?.trim().replace(/^\/+|\/+$/g, "") ?? "";
  const importParentRel = targetSection ? `${paperRel}/${targetSection}` : paperRel;
  resolveModelPath(modelRoot, importParentRel);
  if (!existsSync(path.join(modelRoot, importParentRel, "INDEX.md"))) {
    throw new ModelFsError(`Import target not found: ${importParentRel}`, 404);
  }

  const parsed = parseMarkdownImportStructure(markdown);
  if (!options.importPlan && parsed.sections.length === 0) {
    throw new ModelFsError("No importable sections found in the Word document", 400);
  }

  const importPlan = options.importPlan ? parseImportPlan(options.importPlan) : null;
  if (importPlan && importPlan.length === 0) {
    throw new ModelFsError("importPlan must be a non-empty array", 400);
  }

  const importParentData = await readIndexData(modelRoot, importParentRel);
  const containerKind = containerKindForParent(importParentData.kind);

  if (options.replaceTarget !== false) {
    await clearContainerChildren(modelRoot, importParentRel);
  }

  const paths: string[] = [];
  let sectionsCreated = 0;
  let unitsCreated = 0;

  if (importPlan) {
    const result = await importFromPreviewPlan(modelRoot, importParentRel, importPlan, options);
    sectionsCreated = result.sectionsCreated;
    unitsCreated = result.unitsCreated;
    paths.push(...result.paths);
  } else {
    const usedSectionSlugs = new Set(await orderedChildren(modelRoot, importParentRel));
    const existingOrder = readContainerOrder(importParentData);
    const createdSectionSlugs: string[] = [];

    for (const section of parsed.sections) {
      const sectionSlug = uniqueImportSlug(section.title, usedSectionSlugs);
      const sectionRel = await createNode(modelRoot, importParentRel, sectionSlug, containerKind);
      createdSectionSlugs.push(sectionSlug);
      paths.push(sectionRel);
      sectionsCreated += 1;
      sectionsCreated += section.subsections.length;

      const treeResult = await importSectionTree(modelRoot, sectionRel, section, options);
      unitsCreated += treeResult.unitsCreated;
      paths.push(...treeResult.paths);
    }

    const nextOrder = [...existingOrder];
    for (const slug of createdSectionSlugs) {
      if (!nextOrder.includes(slug)) nextOrder.push(slug);
    }
    await reorderChildren(modelRoot, importParentRel, nextOrder);
  }

  if (parsed.paperTitle && !targetSection) {
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
