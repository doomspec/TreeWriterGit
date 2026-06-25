import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError, createNode, deleteNode, resolveModelPath, isUnitDir, orderedChildren, readIndexData, resolveChildPath, resolveManuscriptSectionsRoot, PAPER_ASSET_DIRS } from "./modelFs.js";
import { collectPendingApprovalPaths } from "./draftApproval.js";
import { parseJournalExportStyle, type JournalExportStyle } from "./journalExportStyle.js";

import type {
  PaperDetail,
  PaperSummary,
  SectionRollup,
  UnitStatusCounts,
} from "@treewriter/shared";

export type { PaperDetail, PaperSummary, SectionRollup, UnitStatusCounts };
export type UnitStatus = "outline" | "drafted" | "approved";

export interface JournalTemplate {
  journal: string;
  targetWords: number;
  sectionOrder: string[];
  export?: JournalExportStyle;
}

export interface UpdatePaperInput {
  slug: string;
  title: string;
  journal: string;
  authors: string[];
  targetWords?: number;
  sectionOrder?: string[];
  status?: string;
  overleafRepoPath?: string | null;
}

export interface ScaffoldPaperInput {
  title: string;
  journal: string;
  authors: string[];
  slug?: string;
  targetWords?: number;
  sectionOrder?: string[];
  status?: string;
  overleafRepoPath?: string | null;
}

const EMPTY_COUNTS: UnitStatusCounts = { approved: 0, drafted: 0, outline: 0, total: 0 };

function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug) {
    throw new ModelFsError("Could not derive slug from title", 400);
  }
  return slug;
}

function normalizeSectionSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || !/^[a-z0-9][a-z0-9-_]*$/.test(slug)) {
    throw new ModelFsError(`Invalid section name: ${JSON.stringify(name)}`, 400);
  }
  return slug;
}

/** Slugify and dedupe user-provided section folder names. */
export function normalizeSectionOrder(names: string[]): string[] {
  const sections = names.map((name) => normalizeSectionSlug(name.trim())).filter(Boolean);
  if (sections.length === 0) {
    throw new ModelFsError("At least one section is required", 400);
  }
  const seen = new Set<string>();
  for (const section of sections) {
    if (seen.has(section)) {
      throw new ModelFsError(`Duplicate section: ${section}`, 400);
    }
    seen.add(section);
  }
  return sections;
}

function journalFileKey(journal: string): string {
  return journal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function bumpCounts(counts: UnitStatusCounts, status: UnitStatus): void {
  counts[status] += 1;
  counts.total += 1;
}

function mergeCounts(into: UnitStatusCounts, from: UnitStatusCounts): void {
  into.approved += from.approved;
  into.drafted += from.drafted;
  into.outline += from.outline;
  into.total += from.total;
}

/** Exported for parity tests against export walk. */
export async function countUnitsUnder(
  modelRoot: string,
  rootRel: string,
): Promise<UnitStatusCounts> {
  const counts = { ...EMPTY_COUNTS };

  async function walk(dirRel: string): Promise<void> {
    if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) {
      return;
    }
    if (await isUnitDir(modelRoot, dirRel)) {
      const data = await readIndexData(modelRoot, dirRel);
      const status = (String(data.status ?? "outline") as UnitStatus) || "outline";
      bumpCounts(counts, status === "approved" || status === "drafted" ? status : "outline");
      return;
    }

    for (const child of await orderedChildren(modelRoot, dirRel)) {
      const childRel = resolveChildPath(modelRoot, dirRel, child);
      if (!childRel) continue;
      await walk(childRel);
    }
  }

  await walk(rootRel);
  return counts;
}

const CONTAINER_SKIP = new Set(["notes", ".sessions", ".trash", ...PAPER_ASSET_DIRS]);

function normalizeUnitStatus(raw: string): UnitStatus {
  if (raw === "approved" || raw === "drafted") return raw;
  return "outline";
}

function countsForUnitIndex(status: UnitStatus): UnitStatusCounts {
  const counts = { ...EMPTY_COUNTS, total: 1 };
  counts[status] = 1;
  return counts;
}

/** Roll up unit approval counts for each folder under a paper (including unit leaves). */
export async function collectContainerCounts(
  modelRoot: string,
  paperRel: string,
): Promise<Record<string, UnitStatusCounts>> {
  const result: Record<string, UnitStatusCounts> = {};

  async function walk(dirRel: string): Promise<void> {
    if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) return;
    const base = path.posix.basename(dirRel);
    if (CONTAINER_SKIP.has(base)) return;
    if (!existsSync(path.join(modelRoot, dirRel))) return;

    if (await isUnitDir(modelRoot, dirRel)) {
      const data = await readIndexData(modelRoot, dirRel);
      result[dirRel] = countsForUnitIndex(normalizeUnitStatus(String(data.status ?? "outline")));
      return;
    }

    result[dirRel] = await countUnitsUnder(modelRoot, dirRel);

    for (const child of await orderedChildren(modelRoot, dirRel)) {
      if (CONTAINER_SKIP.has(child)) continue;
      const childRel = resolveChildPath(modelRoot, dirRel, child);
      if (!childRel) continue;
      await walk(childRel);
    }
  }

  await walk(paperRel);
  return result;
}

export async function listPaperSections(
  modelRoot: string,
  paperRel: string,
): Promise<Array<{ slug: string; path: string; title: string }>> {
  const sections = await topLevelSections(modelRoot, paperRel);
  return sections.map((section) => ({
    slug: path.posix.basename(section.path),
    path: section.path,
    title: section.title,
  }));
}

async function topLevelSections(modelRoot: string, paperRel: string): Promise<{ path: string; title: string }[]> {
  const paperData = await readIndexData(modelRoot, paperRel);
  const sectionOrder = Array.isArray(paperData.section_order)
    ? (paperData.section_order as string[])
    : [];

  const sectionsRoot = await resolveManuscriptSectionsRoot(modelRoot, paperRel);
  const sectionsData =
    sectionsRoot === paperRel ? paperData : await readIndexData(modelRoot, sectionsRoot);
  const childOrder = Array.isArray(sectionsData.child_order)
    ? (sectionsData.child_order as string[])
    : sectionOrder;
  const order = (childOrder.length > 0 ? childOrder : sectionOrder).filter(
    (name) => !PAPER_ASSET_DIRS.has(name),
  );

  return order.map((name) => ({
    path: `${sectionsRoot}/${name}`,
    title: titleCase(name),
  }));
}

export async function loadJournalTemplate(
  modelRoot: string,
  journal: string,
): Promise<JournalTemplate> {
  const templatesDir = path.join(modelRoot, "templates");
  const candidates = [
    path.join(templatesDir, `${journalFileKey(journal)}.md`),
    path.join(templatesDir, "plos-one.md"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const parsed = matter(await readFile(filePath, "utf8"));
    const sectionOrder = Array.isArray(parsed.data.section_order)
      ? (parsed.data.section_order as string[])
      : [];
    if (sectionOrder.length === 0) continue;
    return {
      journal: String(parsed.data.journal ?? journal),
      targetWords: Number(parsed.data.target_words ?? 5000),
      sectionOrder,
      export: parseJournalExportStyle(parsed.data.export),
    };
  }

  throw new ModelFsError(`No journal template found for ${JSON.stringify(journal)}`, 404);
}

async function readJournalTemplateFile(filePath: string, fallbackJournal: string): Promise<JournalTemplate | null> {
  const parsed = matter(await readFile(filePath, "utf8"));
  const sectionOrder = Array.isArray(parsed.data.section_order)
    ? (parsed.data.section_order as string[])
    : [];
  if (sectionOrder.length === 0) return null;
  return {
    journal: String(parsed.data.journal ?? fallbackJournal),
    targetWords: Number(parsed.data.target_words ?? 5000),
    sectionOrder,
    export: parseJournalExportStyle(parsed.data.export),
  };
}

export async function listJournalTemplateDetails(modelRoot: string): Promise<JournalTemplate[]> {
  const templatesDir = path.join(modelRoot, "templates");
  if (!existsSync(templatesDir)) return [];
  const files = await readdir(templatesDir);
  const templates: JournalTemplate[] = [];
  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const fallbackJournal = file.replace(/\.md$/, "");
    const template = await readJournalTemplateFile(path.join(templatesDir, file), fallbackJournal);
    if (template) templates.push(template);
  }
  return templates.sort((a, b) => a.journal.localeCompare(b.journal));
}

export async function listJournalTemplates(modelRoot: string): Promise<string[]> {
  return (await listJournalTemplateDetails(modelRoot)).map((template) => template.journal);
}

export async function scaffoldPaper(
  modelRoot: string,
  input: ScaffoldPaperInput,
): Promise<{ slug: string; path: string }> {
  const slug = input.slug?.trim() || slugify(input.title);
  const paperRel = `papers/${slug}`;
  const paperAbs = resolveModelPath(modelRoot, paperRel);
  if (existsSync(paperAbs)) {
    throw new ModelFsError(`Paper already exists: ${paperRel}`, 409);
  }

  const template = await loadJournalTemplate(modelRoot, input.journal);
  const targetWords =
    input.targetWords != null && Number.isFinite(input.targetWords) && input.targetWords > 0
      ? Math.round(input.targetWords)
      : template.targetWords;
  const sectionOrder =
    input.sectionOrder && input.sectionOrder.length > 0
      ? normalizeSectionOrder(input.sectionOrder)
      : template.sectionOrder;
  const status = input.status?.trim() || "Planning";
  const overleafRepoPath = input.overleafRepoPath?.trim() || null;
  await mkdir(paperAbs, { recursive: true });

  const paperBody = `# ${input.title}\n\n_Thesis / one-line summary._\n`;
  const paperFrontmatter = {
    kind: "paper",
    title: input.title,
    slug,
    journal: template.journal,
    status,
    authors: input.authors,
    target_words: targetWords,
    section_order: sectionOrder,
    overleaf_repo_path: overleafRepoPath,
    last_export: null,
  };
  await writeFile(
    path.join(paperAbs, "INDEX.md"),
    matter.stringify(paperBody, paperFrontmatter),
    "utf8",
  );

  for (const sectionName of sectionOrder) {
    await createNode(modelRoot, paperRel, sectionName, "section");
  }

  for (const assetDir of PAPER_ASSET_DIRS) {
    await createNode(modelRoot, paperRel, assetDir, "section");
  }

  for (const notesDir of ["literature", "data", "feedback"]) {
    const notesRel = `${paperRel}/notes/${notesDir}`;
    await mkdir(path.join(modelRoot, notesRel), { recursive: true });
    await writeFile(
      path.join(modelRoot, notesRel, "INDEX.md"),
      matter.stringify(`# ${titleCase(notesDir)}\n\n`, { kind: "note", title: titleCase(notesDir) }),
      "utf8",
    );
  }

  const exampleSection = sectionOrder[0] ?? "introduction";
  const exampleFigureRel = `${paperRel}/notes/data/fig-example`;
  await writeFile(
    path.join(modelRoot, `${exampleFigureRel}.md`),
    matter.stringify(
      `# Example figure\n\n## Summary\n\n_Describe panels, axes, and what readers should take away._\n`,
      {
        kind: "figure",
        title: "Example figure",
        caption: "Figure 1. Example comparison across conditions.",
        figure_source: `${exampleFigureRel}.mmd`,
        sections: [exampleSection],
      },
    ),
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, `${exampleFigureRel}.mmd`),
    "flowchart LR\n  A[Input] --> B[Output]\n",
    "utf8",
  );

  return { slug, path: paperRel };
}

function paperSectionOrder(data: Record<string, unknown>): string[] {
  return Array.isArray(data.section_order)
    ? (data.section_order as string[]).filter((name) => !PAPER_ASSET_DIRS.has(name))
    : [];
}

function updatePaperBodyTitle(content: string, title: string): string {
  const trimmed = content.trim();
  if (/^\s*#(?!#)\s/m.test(trimmed)) {
    return trimmed.replace(/^\s*#(?!#)\s+[^\n\r]+/, `# ${title}`);
  }
  return `# ${title}\n\n${trimmed}`.trim() + "\n";
}

export async function updatePaper(
  modelRoot: string,
  input: UpdatePaperInput,
): Promise<{ slug: string; path: string }> {
  const slug = input.slug.trim();
  const paperRel = `papers/${slug}`;
  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexPath)) {
    throw new ModelFsError(`Paper not found: ${slug}`, 404);
  }

  const template = await loadJournalTemplate(modelRoot, input.journal);
  const targetWords =
    input.targetWords != null && Number.isFinite(input.targetWords) && input.targetWords > 0
      ? Math.round(input.targetWords)
      : undefined;
  const sectionOrder =
    input.sectionOrder && input.sectionOrder.length > 0
      ? normalizeSectionOrder(input.sectionOrder)
      : undefined;

  const parsed = matter(await readFile(indexPath, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  if (data.kind !== "paper") {
    throw new ModelFsError(`Not a paper: ${paperRel}`, 400);
  }

  const nextTitle = input.title.trim();
  const nextFrontmatter = {
    ...data,
    kind: "paper",
    title: nextTitle,
    slug,
    journal: template.journal,
    status: input.status?.trim() || String(data.status ?? "Planning"),
    authors: input.authors,
    target_words: targetWords ?? Number(data.target_words ?? template.targetWords),
    section_order: sectionOrder ?? paperSectionOrder(data),
    overleaf_repo_path:
      input.overleafRepoPath !== undefined
        ? input.overleafRepoPath?.trim() || null
        : data.overleaf_repo_path ?? null,
  };

  await writeFile(
    indexPath,
    matter.stringify(updatePaperBodyTitle(parsed.content, nextTitle), nextFrontmatter),
    "utf8",
  );

  return { slug, path: paperRel };
}

export async function deletePaper(modelRoot: string, slug: string): Promise<{ slug: string; path: string }> {
  const trimmed = slug.trim();
  const paperRel = `papers/${trimmed}`;
  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexPath)) {
    throw new ModelFsError(`Paper not found: ${trimmed}`, 404);
  }
  const data = await readIndexData(modelRoot, paperRel);
  if (data.kind !== "paper") {
    throw new ModelFsError(`Not a paper: ${paperRel}`, 400);
  }
  await deleteNode(modelRoot, paperRel, true);
  return { slug: trimmed, path: paperRel };
}

async function parsePaperSummary(modelRoot: string, paperRel: string): Promise<PaperSummary | null> {
  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexPath)) return null;
  const parsed = matter(await readFile(indexPath, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  if (data.kind !== "paper") return null;

  const slug = String(data.slug ?? path.basename(paperRel));
  const counts = await countUnitsUnder(modelRoot, paperRel);

  return {
    slug,
    path: paperRel,
    title: String(data.title ?? slug),
    journal: String(data.journal ?? ""),
    status: String(data.status ?? "Planning"),
    lastExport: data.last_export ? String(data.last_export) : null,
    counts,
  };
}

export async function listPapers(modelRoot: string): Promise<PaperSummary[]> {
  const papersDir = path.join(modelRoot, "papers");
  if (!existsSync(papersDir)) return [];

  const entries = await readdir(papersDir, { withFileTypes: true });
  const papers: PaperSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summary = await parsePaperSummary(modelRoot, `papers/${entry.name}`);
    if (summary) papers.push(summary);
  }
  return papers.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPaperDetail(modelRoot: string, slug: string): Promise<PaperDetail> {
  const paperRel = `papers/${slug}`;
  const summary = await parsePaperSummary(modelRoot, paperRel);
  if (!summary) {
    throw new ModelFsError(`Paper not found: ${slug}`, 404);
  }

  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  const parsed = matter(await readFile(indexPath, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  const authors = Array.isArray(data.authors) ? (data.authors as string[]) : [];
  const targetWords = Number(data.target_words ?? 5000);
  const sectionOrder = paperSectionOrder(data);
  const overleafRepoPath = data.overleaf_repo_path ? String(data.overleaf_repo_path) : null;
  const overleafGitUrl = data.overleaf_git_url ? String(data.overleaf_git_url) : null;

  const sections: SectionRollup[] = [];
  for (const section of await topLevelSections(modelRoot, paperRel)) {
    if (!existsSync(path.join(modelRoot, section.path))) continue;
    sections.push({
      path: section.path,
      title: section.title,
      counts: await countUnitsUnder(modelRoot, section.path),
    });
  }

  const containerCounts = await collectContainerCounts(modelRoot, paperRel);
  const pendingApprovalPaths = await collectPendingApprovalPaths(modelRoot, paperRel);

  return {
    ...summary,
    authors,
    targetWords,
    sectionOrder,
    overleafRepoPath,
    overleafGitUrl,
    sections,
    containerCounts,
    pendingApprovalPaths,
  };
}

/** Exported for agent dispatch context gathering. */
export function sectionKeyFromUnitPath(unitPath: string): string | null {
  const parts = unitPath.split("/").filter(Boolean);
  const sectionsIdx = parts.indexOf("sections");
  if (sectionsIdx >= 0 && parts[sectionsIdx + 1]) {
    return parts[sectionsIdx + 1];
  }
  if (parts[0] === "papers" && parts.length >= 3 && parts[2] !== "notes") {
    return parts[2];
  }
  return null;
}

export function paperSlugFromUnitPath(unitPath: string): string | null {
  const parts = unitPath.split("/").filter(Boolean);
  if (parts[0] === "papers" && parts[1]) return parts[1];
  return null;
}
