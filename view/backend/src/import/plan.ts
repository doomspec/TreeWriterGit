import path from "node:path";
import { existsSync } from "node:fs";

import {
  ModelFsError,
  type NodeKind,
  orderedChildren,
  PAPER_ASSET_DIRS,
  readIndexData,
  resolveModelPath,
} from "../modelFs.js";
import { uniqueImportSlug, type ParsedDocxMarkdown } from "./parse.js";
import type { DocxImportPreviewNode, DocxImportTargetOption } from "./types.js";

export function containerKindForParent(parentKind: unknown): NodeKind {
  if (parentKind === "paper") return "section";
  if (parentKind === "section" || parentKind === "subsection") return "subsection";
  return "subsection";
}

function orderFieldForParent(data: Record<string, unknown>): "section_order" | "child_order" {
  if (data.kind === "paper") return "section_order";
  if (Array.isArray(data.section_order) && (data.section_order as string[]).length > 0) {
    return "section_order";
  }
  return "child_order";
}

export function readContainerOrder(data: Record<string, unknown>): string[] {
  const key = orderFieldForParent(data);
  return Array.isArray(data[key]) ? [...(data[key] as string[])] : [];
}

function countPreviewNodes(nodes: DocxImportPreviewNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    if (node.children?.length) count += countPreviewNodes(node.children);
  }
  return count;
}

export async function buildExistingPreviewTree(
  modelRoot: string,
  parentRel: string,
): Promise<DocxImportPreviewNode[]> {
  const children = await orderedChildren(modelRoot, parentRel);
  const nodes: DocxImportPreviewNode[] = [];

  for (const child of children) {
    const childRel = `${parentRel}/${child}`;
    const data = await readIndexData(modelRoot, childRel);
    const rawKind = String(data.kind ?? "section");
    if (rawKind === "unit") {
      nodes.push({
        title: String(data.title ?? child),
        slug: child,
        kind: "unit",
      });
      continue;
    }
    if (rawKind === "section" || rawKind === "subsection") {
      const grandchildren = await buildExistingPreviewTree(modelRoot, childRel);
      nodes.push({
        title: String(data.title ?? child),
        slug: child,
        kind: rawKind,
        children: grandchildren.length > 0 ? grandchildren : undefined,
      });
    }
  }

  return nodes;
}

function parseImportPlanNode(raw: unknown): DocxImportPreviewNode {
  if (!raw || typeof raw !== "object") {
    throw new ModelFsError("Invalid import plan node", 400);
  }
  const record = raw as Record<string, unknown>;
  const title = String(record.title ?? "").trim();
  const slug = String(record.slug ?? "").trim();
  const kind = record.kind;
  if (!title) throw new ModelFsError("Import plan node requires a title", 400);
  if (!slug) throw new ModelFsError("Import plan node requires a slug", 400);
  if (kind !== "section" && kind !== "subsection" && kind !== "unit") {
    throw new ModelFsError("Import plan node kind must be section, subsection, or unit", 400);
  }
  const body = typeof record.body === "string" ? record.body : undefined;
  const childrenRaw = record.children;
  const children = Array.isArray(childrenRaw)
    ? childrenRaw.map((child) => parseImportPlanNode(child))
    : undefined;
  if (kind === "unit" && children?.length) {
    throw new ModelFsError("Unit nodes cannot have children in an import plan", 400);
  }
  return {
    title,
    slug,
    kind,
    body,
    children: children?.length ? children : undefined,
  };
}

export function parseImportPlan(raw: unknown): DocxImportPreviewNode[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ModelFsError("importPlan must be a non-empty array", 400);
  }
  return raw.map((node) => parseImportPlanNode(node));
}

export function planImportedPreviewTree(
  parsed: ParsedDocxMarkdown,
  containerKind: NodeKind,
): { nodes: DocxImportPreviewNode[]; sectionsCreated: number; unitsCreated: number } {
  const usedSectionSlugs = new Set<string>();
  const nodes: DocxImportPreviewNode[] = [];
  let sectionsCreated = 0;
  let unitsCreated = 0;
  const previewKind = containerKind === "section" ? "section" : "subsection";

  for (const section of parsed.sections) {
    const sectionSlug = uniqueImportSlug(section.title, usedSectionSlugs);
    sectionsCreated += 1;
    const children: DocxImportPreviewNode[] = [];

    const usedUnitSlugs = new Set<string>();
    for (const unit of section.units) {
      const unitSlug = uniqueImportSlug(unit.title, usedUnitSlugs);
      unitsCreated += 1;
      children.push({ title: unit.title, slug: unitSlug, kind: "unit", body: unit.body });
    }

    for (const sub of section.subsections) {
      const subSlug = uniqueImportSlug(sub.title, usedUnitSlugs);
      sectionsCreated += 1;
      const subUnits: DocxImportPreviewNode[] = [];
      const usedSubUnitSlugs = new Set<string>();
      for (const unit of sub.units) {
        const unitSlug = uniqueImportSlug(unit.title, usedSubUnitSlugs);
        unitsCreated += 1;
        subUnits.push({ title: unit.title, slug: unitSlug, kind: "unit", body: unit.body });
      }
      children.push({
        title: sub.title,
        slug: subSlug,
        kind: "subsection",
        children: subUnits,
      });
    }

    nodes.push({
      title: section.title,
      slug: sectionSlug,
      kind: previewKind,
      children: children.length > 0 ? children : undefined,
    });
  }

  return { nodes, sectionsCreated, unitsCreated };
}

export async function listImportTargetOptions(
  modelRoot: string,
  paperRel: string,
): Promise<DocxImportTargetOption[]> {
  const paperData = await readIndexData(modelRoot, paperRel);
  const paperTitle = String(paperData.title ?? paperRel.split("/").pop() ?? "Paper");
  const paperExisting = await buildExistingPreviewTree(modelRoot, paperRel);
  const targets: DocxImportTargetOption[] = [
    {
      slug: "",
      path: paperRel,
      title: `${paperTitle} (paper root)`,
      existingNodeCount: countPreviewNodes(paperExisting),
    },
  ];

  async function walkContainers(parentRel: string, relPrefix: string, depth: number): Promise<void> {
    if (depth > 6) return;
    const parentData = await readIndexData(modelRoot, parentRel);
    for (const name of readContainerOrder(parentData)) {
      if (PAPER_ASSET_DIRS.has(name)) continue;
      const childRel = `${parentRel}/${name}`;
      if (!existsSync(path.join(modelRoot, childRel, "INDEX.md"))) continue;
      const childData = await readIndexData(modelRoot, childRel);
      const kind = String(childData.kind ?? "");
      if (kind !== "section" && kind !== "subsection" && kind !== "paper") continue;
      const slug = relPrefix ? `${relPrefix}/${name}` : name;
      const existing = await buildExistingPreviewTree(modelRoot, childRel);
      targets.push({
        slug,
        path: childRel,
        title: String(childData.title ?? name),
        existingNodeCount: countPreviewNodes(existing),
      });
      await walkContainers(childRel, slug, depth + 1);
    }
  }

  await walkContainers(paperRel, "", 0);
  return targets;
}

export function resolveImportParent(
  modelRoot: string,
  paperSlug: string,
  targetSection?: string | null,
): { paperRel: string; importParentRel: string; importTargetSlug: string } {
  const paperRel = `papers/${paperSlug.trim()}`;
  resolveModelPath(modelRoot, paperRel);
  if (!existsSync(path.join(modelRoot, paperRel, "INDEX.md"))) {
    throw new ModelFsError(`Paper not found: ${paperRel}`, 404);
  }

  const importTargetSlug = targetSection?.trim().replace(/^\/+|\/+$/g, "") ?? "";
  const importParentRel = importTargetSlug ? `${paperRel}/${importTargetSlug}` : paperRel;
  resolveModelPath(modelRoot, importParentRel);
  if (!existsSync(path.join(modelRoot, importParentRel, "INDEX.md"))) {
    throw new ModelFsError(`Import target not found: ${importParentRel}`, 404);
  }

  return { paperRel, importParentRel, importTargetSlug };
}
