import path from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

import { approveDraftTarget } from "../draftApproval/workflow.js";
import {
  createNode,
  deleteNode,
  type NodeKind,
  orderedChildren,
  PAPER_ASSET_DIRS,
  readIndexData,
  reorderChildren,
} from "../modelFs.js";
import { uniqueImportSlug, type DocxImportSection } from "./parse.js";
import type { DocxImportOptions, DocxImportPreviewNode } from "./types.js";
import { containerKindForParent } from "./plan.js";

async function importSectionUnits(
  modelRoot: string,
  sectionRel: string,
  units: DocxImportSection["units"],
  options: DocxImportOptions,
): Promise<{ unitsCreated: number; paths: string[]; unitSlugs: string[] }> {
  const usedUnitSlugs = new Set(await orderedChildren(modelRoot, sectionRel));
  const unitSlugs: string[] = [];
  const paths: string[] = [];
  let unitsCreated = 0;

  for (const unit of units) {
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

  return { unitsCreated, paths, unitSlugs };
}

export async function importSectionTree(
  modelRoot: string,
  containerRel: string,
  section: DocxImportSection,
  options: DocxImportOptions,
): Promise<{ unitsCreated: number; paths: string[]; childSlugs: string[] }> {
  const paths: string[] = [];
  let unitsCreated = 0;
  const childSlugs: string[] = [];

  const directUnits = await importSectionUnits(modelRoot, containerRel, section.units, options);
  unitsCreated += directUnits.unitsCreated;
  paths.push(...directUnits.paths);
  childSlugs.push(...directUnits.unitSlugs);

  const usedSubSlugs = new Set(await orderedChildren(modelRoot, containerRel));
  for (const slug of directUnits.unitSlugs) usedSubSlugs.add(slug);
  for (const sub of section.subsections) {
    const subSlug = uniqueImportSlug(sub.title, usedSubSlugs);
    const subRel = await createNode(modelRoot, containerRel, subSlug, "subsection");
    childSlugs.push(subSlug);
    paths.push(subRel);

    const subUnits = await importSectionUnits(modelRoot, subRel, sub.units, options);
    unitsCreated += subUnits.unitsCreated;
    paths.push(...subUnits.paths);
    if (subUnits.unitSlugs.length > 0) {
      await reorderChildren(modelRoot, subRel, subUnits.unitSlugs);
    }
  }

  if (childSlugs.length > 0) {
    await reorderChildren(modelRoot, containerRel, childSlugs);
  }

  return { unitsCreated, paths, childSlugs };
}

export async function clearContainerChildren(modelRoot: string, parentRel: string): Promise<void> {
  const parentData = await readIndexData(modelRoot, parentRel);
  const isPaper = parentData.kind === "paper";
  const children = await orderedChildren(modelRoot, parentRel);
  for (const child of [...children].reverse()) {
    await deleteNode(modelRoot, `${parentRel}/${child}`, true);
  }

  if (isPaper) {
    const sectionOrder = Array.isArray(parentData.section_order)
      ? (parentData.section_order as string[])
      : [];
    const preserved = sectionOrder.filter((name) => PAPER_ASSET_DIRS.has(name));
    await reorderChildren(modelRoot, parentRel, preserved);
  } else {
    await reorderChildren(modelRoot, parentRel, []);
  }
}

async function importPreviewPlanTree(
  modelRoot: string,
  parentRel: string,
  nodes: DocxImportPreviewNode[],
  depth: number,
  importContainerKind: NodeKind,
  options: DocxImportOptions,
): Promise<{ sectionsCreated: number; unitsCreated: number; paths: string[]; childSlugs: string[] }> {
  const paths: string[] = [];
  let sectionsCreated = 0;
  let unitsCreated = 0;
  const usedSlugs = new Set(await orderedChildren(modelRoot, parentRel));
  const childSlugs: string[] = [];

  for (const node of nodes) {
    if (node.kind === "unit") {
      const unitSlug = uniqueImportSlug(node.title, usedSlugs);
      const unitRel = await createNode(modelRoot, parentRel, unitSlug, "unit");
      const draftRel = `${unitRel}/draft.md`;
      const body = (node.body ?? node.title).trim();
      await writeFile(path.join(modelRoot, draftRel), `${body}\n`, "utf8");
      if (options.autoApprove !== false) {
        await approveDraftTarget(
          modelRoot,
          draftRel,
          options.approvedBy ?? "docx-import",
        );
      }
      childSlugs.push(unitSlug);
      paths.push(unitRel, draftRel);
      unitsCreated += 1;
      continue;
    }

    const kind: NodeKind =
      depth === 0 ? importContainerKind : node.kind === "subsection" ? "subsection" : "subsection";
    const slug = uniqueImportSlug(node.title, usedSlugs);
    const nodeRel = await createNode(modelRoot, parentRel, slug, kind);
    childSlugs.push(slug);
    paths.push(nodeRel);
    sectionsCreated += 1;

    if (node.children?.length) {
      const nested = await importPreviewPlanTree(
        modelRoot,
        nodeRel,
        node.children,
        depth + 1,
        importContainerKind,
        options,
      );
      sectionsCreated += nested.sectionsCreated;
      unitsCreated += nested.unitsCreated;
      paths.push(...nested.paths);
      if (nested.childSlugs.length > 0) {
        await reorderChildren(modelRoot, nodeRel, nested.childSlugs);
      }
    }
  }

  return { sectionsCreated, unitsCreated, paths, childSlugs };
}

export async function importFromPreviewPlan(
  modelRoot: string,
  importParentRel: string,
  importPlan: DocxImportPreviewNode[],
  options: DocxImportOptions,
): Promise<{ sectionsCreated: number; unitsCreated: number; paths: string[]; childSlugs: string[] }> {
  const importParentData = await readIndexData(modelRoot, importParentRel);
  const importContainerKind = containerKindForParent(importParentData.kind);
  const result = await importPreviewPlanTree(
    modelRoot,
    importParentRel,
    importPlan,
    0,
    importContainerKind,
    options,
  );
  if (result.childSlugs.length > 0) {
    await reorderChildren(modelRoot, importParentRel, result.childSlugs);
  }
  return result;
}
