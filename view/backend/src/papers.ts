import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError, createNode, resolveModelPath, isUnitDir, orderedChildren, readIndexData, resolveChildPath } from "./modelFs.js";

export type UnitStatus = "outline" | "drafted" | "approved";

export interface UnitStatusCounts {
  approved: number;
  drafted: number;
  outline: number;
  total: number;
}

export interface SectionRollup {
  path: string;
  title: string;
  counts: UnitStatusCounts;
}

export interface PaperSummary {
  slug: string;
  path: string;
  title: string;
  journal: string;
  status: string;
  lastExport: string | null;
  counts: UnitStatusCounts;
}

export interface PaperDetail extends PaperSummary {
  sections: SectionRollup[];
}

export interface JournalTemplate {
  journal: string;
  targetWords: number;
  sectionOrder: string[];
}

export interface ScaffoldPaperInput {
  title: string;
  journal: string;
  authors: string[];
  slug?: string;
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

async function topLevelSections(modelRoot: string, paperRel: string): Promise<{ path: string; title: string }[]> {
  const paperData = await readIndexData(modelRoot, paperRel);
  const sectionOrder = Array.isArray(paperData.section_order)
    ? (paperData.section_order as string[])
    : [];

  const sectionsRoot = `${paperRel}/sections`;
  if (existsSync(path.join(modelRoot, sectionsRoot))) {
    const sectionsData = await readIndexData(modelRoot, sectionsRoot);
    const childOrder = Array.isArray(sectionsData.child_order)
      ? (sectionsData.child_order as string[])
      : sectionOrder;
    const order = childOrder.length > 0 ? childOrder : sectionOrder;
    return order.map((name) => ({
      path: `${sectionsRoot}/${name}`,
      title: titleCase(name),
    }));
  }

  return sectionOrder.map((name) => ({
    path: `${paperRel}/${name}`,
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
    };
  }

  throw new ModelFsError(`No journal template found for ${JSON.stringify(journal)}`, 404);
}

export async function listJournalTemplates(modelRoot: string): Promise<string[]> {
  const templatesDir = path.join(modelRoot, "templates");
  if (!existsSync(templatesDir)) return [];
  const files = await readdir(templatesDir);
  const names: string[] = [];
  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const parsed = matter(await readFile(path.join(templatesDir, file), "utf8"));
    names.push(String(parsed.data.journal ?? file.replace(/\.md$/, "")));
  }
  return names.sort();
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
  await mkdir(paperAbs, { recursive: true });

  const paperBody = `# ${input.title}\n\n_Thesis / one-line summary._\n`;
  const paperFrontmatter = {
    kind: "paper",
    title: input.title,
    slug,
    journal: template.journal,
    status: "Planning",
    authors: input.authors,
    target_words: template.targetWords,
    section_order: template.sectionOrder,
    overleaf_repo_path: null,
    last_export: null,
  };
  await writeFile(
    path.join(paperAbs, "INDEX.md"),
    matter.stringify(paperBody, paperFrontmatter),
    "utf8",
  );

  const sectionsRel = `${paperRel}/sections`;
  await mkdir(path.join(modelRoot, sectionsRel), { recursive: true });
  await writeFile(
    path.join(modelRoot, sectionsRel, "INDEX.md"),
    matter.stringify(`# Sections\n\n_Ordered top-level sections for this paper._\n`, {
      kind: "section",
      title: "Sections",
      child_order: template.sectionOrder,
    }),
    "utf8",
  );

  for (const sectionName of template.sectionOrder) {
    await createNode(modelRoot, sectionsRel, sectionName, "section");
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

  return { slug, path: paperRel };
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

  const sections: SectionRollup[] = [];
  for (const section of await topLevelSections(modelRoot, paperRel)) {
    if (!existsSync(path.join(modelRoot, section.path))) continue;
    sections.push({
      path: section.path,
      title: section.title,
      counts: await countUnitsUnder(modelRoot, section.path),
    });
  }

  return { ...summary, sections };
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
