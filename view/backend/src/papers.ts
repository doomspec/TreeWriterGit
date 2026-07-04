import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError, createNode, deleteNode, resolveModelPath, resolvePaperRel, isUnitDir, orderedChildren, readIndexData, resolveChildPath, resolveManuscriptSectionsRoot, PAPER_ASSET_DIRS } from "./modelFs.js";
import { collectPendingReviewItems } from "./draftApproval.js";
import { buildCombinedMarkdown } from "./export/assembly.js";
import { countMarkdownWords } from "@treewriter/shared";

import {
  loadJournalTemplate,
  loadTemplate,
  listJournalTemplateDetails,
  listJournalTemplates,
  listManuscriptTemplates,
  type JournalTemplate,
  type ManuscriptTemplate,
} from "./papers/templates.js";
import { isManuscriptRoot, docTypeFromIndex, contributionModeFromIndex } from "./model/manuscriptKind.js";
import { normalizeManuscriptTags, normalizeProjectSlug } from "./model/manuscriptTags.js";
import { syncContributorsAfterManuscriptSave } from "./contributorsRegistry.js";

import type {
  AuthorEntry,
  ContributionMode,
  CreditRole,
  DocumentType,
  ManuscriptDetail,
  ManuscriptSummary,
  PaperDetail,
  PaperSummary,
  SectionRollup,
  UnitStatusCounts,
} from "@treewriter/shared";
import { CREDIT_ROLES, authorFullName } from "@treewriter/shared";

export type { ManuscriptDetail, ManuscriptSummary, PaperDetail, PaperSummary, SectionRollup, UnitStatusCounts };
export type UnitStatus = "outline" | "drafted" | "approved";
export type { JournalTemplate, ManuscriptTemplate };
export {
  loadJournalTemplate,
  loadTemplate,
  listJournalTemplateDetails,
  listJournalTemplates,
  listManuscriptTemplates,
};

export interface UpdateManuscriptInput {
  slug: string;
  title: string;
  /** Structured authors; legacy `string[]` names still accepted (normalized on write). */
  authors: (AuthorEntry | string)[];
  affiliations?: string[];
  journal?: string;
  templateId?: string;
  targetWords?: number;
  sectionOrder?: string[];
  status?: string;
  overleafRepoPath?: string | null;
  funder?: string | null;
  program?: string | null;
  deadline?: string | null;
  audience?: string | null;
  tags?: string[];
  project?: string | null;
  contributionMode?: ContributionMode | null;
  agentSummary?: string | null;
}

/** @deprecated Use UpdateManuscriptInput */
export type UpdatePaperInput = UpdateManuscriptInput & { journal: string };

export interface ScaffoldManuscriptInput {
  title: string;
  /** Structured authors; legacy `string[]` names still accepted (normalized on write). */
  authors: (AuthorEntry | string)[];
  affiliations?: string[];
  slug?: string;
  docType?: DocumentType;
  templateId?: string;
  journal?: string;
  targetWords?: number;
  sectionOrder?: string[];
  status?: string;
  overleafRepoPath?: string | null;
  funder?: string | null;
  program?: string | null;
  deadline?: string | null;
  audience?: string | null;
  tags?: string[];
  project?: string | null;
  contributionMode?: ContributionMode | null;
  agentSummary?: string | null;
}

/** @deprecated Use ScaffoldManuscriptInput */
export type ScaffoldPaperInput = ScaffoldManuscriptInput & { journal: string };

export type ListManuscriptsOptions = {
  docType?: DocumentType;
  tag?: string;
};

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

/** Trimmed, non-empty affiliation lines. */
export function normalizeAffiliations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => String(entry).trim()).filter(Boolean);
}

/**
 * Per-author affiliation index lists (1-based), clamped to the actual number of
 * affiliations and authors. Parallel to `authors`; entries out of range or for
 * absent affiliations are dropped so the LaTeX title block never references a
 * missing \item.
 */
export function normalizeAuthorAffiliations(
  raw: unknown,
  authorCount: number,
  affiliationCount: number,
): number[][] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, authorCount).map((entry) => {
    if (!Array.isArray(entry)) return [];
    const valid = entry
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= affiliationCount);
    return [...new Set(valid)].sort((a, b) => a - b);
  });
}

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
const CREDIT_SET = new Set<string>(CREDIT_ROLES);

function normalizeCredit(raw: unknown): CreditRole[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<CreditRole>();
  for (const entry of raw) {
    const role = String(entry).trim();
    if (CREDIT_SET.has(role)) seen.add(role as CreditRole);
  }
  return CREDIT_ROLES.filter((role) => seen.has(role));
}

function normalizeAffiliationIndices(raw: unknown, affiliationCount: number): number[] {
  if (!Array.isArray(raw)) return [];
  const valid = raw
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= affiliationCount);
  return [...new Set(valid)].sort((a, b) => a - b);
}

/** Split a legacy single-string author name into structured parts (first / middle / last). */
function splitLegacyName(full: string): Pick<AuthorEntry, "firstName" | "middleName" | "lastName"> {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(" ") || undefined,
  };
}

/**
 * Structured authors from frontmatter. Accepts the new object shape and the
 * legacy `authors: string[]` shape (splitting names and pulling per-author
 * affiliations from a parallel `author_affiliations` list) so existing papers
 * keep working. Affiliation indices are clamped to the real affiliation count.
 */
export function normalizeAuthors(
  raw: unknown,
  affiliationCount: number,
  legacyAuthorAffiliations?: unknown,
): AuthorEntry[] {
  if (!Array.isArray(raw)) return [];
  const legacyAff = normalizeAuthorAffiliations(
    legacyAuthorAffiliations,
    raw.length,
    affiliationCount,
  );
  const entries: AuthorEntry[] = [];
  raw.forEach((item, index) => {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) return;
      entries.push({ ...splitLegacyName(name), affiliations: legacyAff[index] ?? [] });
      return;
    }
    if (!item || typeof item !== "object") return;
    const obj = item as Record<string, unknown>;
    const firstName = String(obj.firstName ?? obj.first_name ?? "").trim();
    const middleName = String(obj.middleName ?? obj.middle_name ?? "").trim();
    const lastName = String(obj.lastName ?? obj.last_name ?? "").trim();
    if (!firstName && !lastName && !middleName) return;
    const orcid = String(obj.orcid ?? "").trim();
    const email = String(obj.email ?? "").trim();
    const author: AuthorEntry = {
      firstName,
      lastName,
      affiliations: normalizeAffiliationIndices(obj.affiliations, affiliationCount),
    };
    if (middleName) author.middleName = middleName;
    if (ORCID_RE.test(orcid)) author.orcid = orcid;
    if (obj.equalContribution === true || obj.equal_contribution === true) {
      author.equalContribution = true;
    }
    if (obj.corresponding === true) author.corresponding = true;
    if (email) author.email = email;
    const credit = normalizeCredit(obj.credit);
    if (credit.length > 0) author.credit = credit;
    entries.push(author);
  });
  return entries;
}

/** Serialize structured authors to plain frontmatter objects (drop empty optionals). */
export function authorsToFrontmatter(authors: AuthorEntry[]): Record<string, unknown>[] {
  return authors.map((author) => {
    const record: Record<string, unknown> = { firstName: author.firstName, lastName: author.lastName };
    if (author.middleName) record.middleName = author.middleName;
    if (author.orcid) record.orcid = author.orcid;
    if (author.affiliations.length > 0) record.affiliations = author.affiliations;
    if (author.equalContribution) record.equalContribution = true;
    if (author.corresponding) record.corresponding = true;
    if (author.email) record.email = author.email;
    if (author.credit && author.credit.length > 0) record.credit = author.credit;
    return record;
  });
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

const CONTAINER_SKIP = new Set(["notes", ".sessions", ".trash", ".approval", ...PAPER_ASSET_DIRS]);

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

async function readUnitDraftWordCount(modelRoot: string, unitRel: string): Promise<number> {
  const draftPath = path.join(modelRoot, unitRel, "draft.md");
  if (!existsSync(draftPath)) return 0;
  try {
    const raw = await readFile(draftPath, "utf8");
    const parsed = matter(raw);
    const body = typeof parsed.content === "string" ? parsed.content : raw;
    return countMarkdownWords(body);
  } catch {
    return 0;
  }
}

/** Roll up draft word counts for each folder under a paper (including unit leaves). */
export async function collectContainerWordCounts(
  modelRoot: string,
  paperRel: string,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  async function walk(dirRel: string): Promise<number> {
    if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) return 0;
    const base = path.posix.basename(dirRel);
    if (CONTAINER_SKIP.has(base)) return 0;
    if (!existsSync(path.join(modelRoot, dirRel))) return 0;

    if (await isUnitDir(modelRoot, dirRel)) {
      const words = await readUnitDraftWordCount(modelRoot, dirRel);
      result[dirRel] = words;
      return words;
    }

    let sum = 0;
    for (const child of await orderedChildren(modelRoot, dirRel)) {
      if (CONTAINER_SKIP.has(child)) continue;
      const childRel = resolveChildPath(modelRoot, dirRel, child);
      if (!childRel) continue;
      sum += await walk(childRel);
    }
    result[dirRel] = sum;
    return sum;
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


async function resolveTemplate(
  modelRoot: string,
  input: { templateId?: string; journal?: string; docType?: DocumentType },
): Promise<ManuscriptTemplate & { journal?: string }> {
  if (input.templateId?.trim()) {
    return loadTemplate(modelRoot, input.templateId.trim());
  }
  if (input.journal?.trim()) {
    return loadJournalTemplate(modelRoot, input.journal.trim());
  }
  const docType = input.docType ?? "paper";
  const defaults: Record<DocumentType, string> = {
    paper: "plos-one",
    grant: "nsf-research-proposal",
    report: "technical-report",
  };
  return loadTemplate(modelRoot, defaults[docType]);
}

export async function scaffoldManuscript(
  modelRoot: string,
  input: ScaffoldManuscriptInput,
): Promise<{ slug: string; path: string }> {
  const slug = input.slug?.trim() || slugify(input.title);
  const paperRel = resolvePaperRel(modelRoot, slug);
  const paperAbs = resolveModelPath(modelRoot, paperRel);
  if (existsSync(paperAbs)) {
    throw new ModelFsError(`Manuscript already exists: ${paperRel}`, 409);
  }

  const template = await resolveTemplate(modelRoot, input);
  const docType = input.docType ?? template.docType;
  const targetWords =
    input.targetWords != null && Number.isFinite(input.targetWords) && input.targetWords > 0
      ? Math.round(input.targetWords)
      : template.targetWords;
  const sectionOrder =
    input.sectionOrder && input.sectionOrder.length > 0
      ? normalizeSectionOrder(input.sectionOrder)
      : template.sectionOrder;
  const status = input.status?.trim() || template.statusOptions[0] || "Planning";
  const overleafRepoPath = docType === "paper" ? input.overleafRepoPath?.trim() || null : null;
  const tags = normalizeManuscriptTags(input.tags);
  const project = normalizeProjectSlug(input.project);

  await mkdir(paperAbs, { recursive: true });

  const paperBody = `# ${input.title}\n\n_Thesis / one-line summary._\n`;
  const paperFrontmatter: Record<string, unknown> = {
    kind: "manuscript",
    doc_type: docType,
    template_id: template.templateId,
    title: input.title,
    slug,
    status,
    target_words: targetWords,
    section_order: sectionOrder,
    last_export: null,
    tags,
    project,
  };
  const scaffoldAffiliations = normalizeAffiliations(input.affiliations);
  const scaffoldAuthors = normalizeAuthors(input.authors, scaffoldAffiliations.length);
  if (scaffoldAuthors.length > 0) {
    paperFrontmatter.authors = authorsToFrontmatter(scaffoldAuthors);
  }
  if (scaffoldAffiliations.length > 0) {
    paperFrontmatter.affiliations = scaffoldAffiliations;
  }
  if (docType === "paper" && (template.journal || input.journal)) {
    paperFrontmatter.journal = template.journal ?? input.journal;
    paperFrontmatter.overleaf_repo_path = overleafRepoPath;
  }
  if (docType === "grant") {
    if (input.funder?.trim()) paperFrontmatter.funder = input.funder.trim();
    if (input.program?.trim()) paperFrontmatter.program = input.program.trim();
    if (input.deadline?.trim()) paperFrontmatter.deadline = input.deadline.trim();
  }
  if (docType === "report" && input.audience?.trim()) {
    paperFrontmatter.audience = input.audience.trim();
  }
  if (input.contributionMode) paperFrontmatter.contribution_mode = input.contributionMode;
  if (input.agentSummary?.trim()) paperFrontmatter.agent_summary = input.agentSummary.trim();

  await writeFile(
    path.join(paperAbs, "INDEX.md"),
    matter.stringify(paperBody, paperFrontmatter),
    "utf8",
  );

  for (const sectionName of sectionOrder) {
    await createNode(modelRoot, paperRel, sectionName, "section");
  }

  for (const assetDir of template.assetDirs) {
    await createNode(modelRoot, paperRel, assetDir, "section");
  }

  for (const notesDir of template.notesDirs) {
    const notesRel = `${paperRel}/notes/${notesDir}`;
    await mkdir(path.join(modelRoot, notesRel), { recursive: true });
    await writeFile(
      path.join(modelRoot, notesRel, "INDEX.md"),
      matter.stringify(`# ${titleCase(notesDir)}\n\n`, { kind: "note", title: titleCase(notesDir) }),
      "utf8",
    );
  }


  const seedExampleFigure =
    docType === "paper" &&
    template.notesDirs.includes("data") &&
    sectionOrder.length > 0;
  if (seedExampleFigure) {
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
  }

  await syncContributorsAfterManuscriptSave(modelRoot, scaffoldAuthors, scaffoldAffiliations);

  return { slug, path: paperRel };
}

/** @deprecated Use scaffoldManuscript */
export async function scaffoldPaper(
  modelRoot: string,
  input: ScaffoldPaperInput,
): Promise<{ slug: string; path: string }> {
  return scaffoldManuscript(modelRoot, { ...input, docType: "paper" });
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

export async function updateManuscript(
  modelRoot: string,
  input: UpdateManuscriptInput,
): Promise<{ slug: string; path: string }> {
  const slug = input.slug.trim();
  const paperRel = resolvePaperRel(modelRoot, slug);
  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexPath)) {
    throw new ModelFsError(`Manuscript not found: ${slug}`, 404);
  }

  const parsed = matter(await readFile(indexPath, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  if (!isManuscriptRoot(data)) {
    throw new ModelFsError(`Not a manuscript: ${paperRel}`, 400);
  }

  const docType = docTypeFromIndex(data);
  const template = await resolveTemplate(modelRoot, {
    templateId: input.templateId ?? (data.template_id ? String(data.template_id) : undefined),
    journal: input.journal ?? (data.journal ? String(data.journal) : undefined),
    docType,
  });

  const targetWords =
    input.targetWords != null && Number.isFinite(input.targetWords) && input.targetWords > 0
      ? Math.round(input.targetWords)
      : undefined;
  const sectionOrder =
    input.sectionOrder && input.sectionOrder.length > 0
      ? normalizeSectionOrder(input.sectionOrder)
      : undefined;

  const nextTitle = input.title.trim();
  const tags = input.tags !== undefined ? normalizeManuscriptTags(input.tags) : normalizeManuscriptTags(data.tags);
  const project =
    input.project !== undefined ? normalizeProjectSlug(input.project) : normalizeProjectSlug(data.project);

  const nextFrontmatter: Record<string, unknown> = {
    ...data,
    kind: isManuscriptRoot(data) && data.kind === "paper" ? "paper" : "manuscript",
    doc_type: docType,
    template_id: template.templateId,
    title: nextTitle,
    slug,
    status: input.status?.trim() || String(data.status ?? "Planning"),
    target_words: targetWords ?? Number(data.target_words ?? template.targetWords),
    section_order: sectionOrder ?? paperSectionOrder(data),
    tags,
    project,
  };

  if (docType === "paper") {
    nextFrontmatter.journal = template.journal ?? input.journal ?? data.journal;
    nextFrontmatter.overleaf_repo_path =
      input.overleafRepoPath !== undefined
        ? input.overleafRepoPath?.trim() || null
        : data.overleaf_repo_path ?? null;
  }

  // Affiliations (the shared numbered list) and structured authors are rewritten
  // together — author affiliation indices are clamped to the effective list.
  const nextAffiliations =
    input.affiliations !== undefined
      ? normalizeAffiliations(input.affiliations)
      : normalizeAffiliations(data.affiliations);
  if (nextAffiliations.length > 0) {
    nextFrontmatter.affiliations = nextAffiliations;
  } else {
    delete nextFrontmatter.affiliations;
  }
  const nextAuthors = normalizeAuthors(input.authors, nextAffiliations.length);
  if (nextAuthors.length > 0) {
    nextFrontmatter.authors = authorsToFrontmatter(nextAuthors);
  } else {
    delete nextFrontmatter.authors;
  }
  // Legacy parallel mapping is superseded by per-author affiliations; drop it.
  delete nextFrontmatter.author_affiliations;

  if (input.funder !== undefined) nextFrontmatter.funder = input.funder?.trim() || null;
  if (input.program !== undefined) nextFrontmatter.program = input.program?.trim() || null;
  if (input.deadline !== undefined) nextFrontmatter.deadline = input.deadline?.trim() || null;
  if (input.audience !== undefined) nextFrontmatter.audience = input.audience?.trim() || null;
  if (input.contributionMode !== undefined) {
    nextFrontmatter.contribution_mode = input.contributionMode;
  }
  if (input.agentSummary !== undefined) {
    nextFrontmatter.agent_summary = input.agentSummary?.trim() || null;
  }

  await writeFile(
    indexPath,
    matter.stringify(updatePaperBodyTitle(parsed.content, nextTitle), nextFrontmatter),
    "utf8",
  );

  await syncContributorsAfterManuscriptSave(modelRoot, nextAuthors, nextAffiliations);

  return { slug, path: paperRel };
}

/** @deprecated Use updateManuscript */
export async function updatePaper(modelRoot: string, input: UpdatePaperInput): Promise<{ slug: string; path: string }> {
  return updateManuscript(modelRoot, input);
}

export async function deletePaper(modelRoot: string, slug: string): Promise<{ slug: string; path: string }> {
  const paperRel = resolvePaperRel(modelRoot, slug.trim());
  const trimmed = paperRel.slice("papers/".length);
  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexPath)) {
    throw new ModelFsError(`Paper not found: ${trimmed}`, 404);
  }
  const data = await readIndexData(modelRoot, paperRel);
  if (!isManuscriptRoot(data)) {
    throw new ModelFsError(`Not a manuscript: ${paperRel}`, 400);
  }
  await deleteNode(modelRoot, paperRel, true);
  return { slug: trimmed, path: paperRel };
}

async function parseManuscriptSummary(modelRoot: string, paperRel: string): Promise<ManuscriptSummary | null> {
  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexPath)) return null;
  const parsed = matter(await readFile(indexPath, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  if (!isManuscriptRoot(data)) return null;

  const slug = String(data.slug ?? path.basename(paperRel));
  const counts = await countUnitsUnder(modelRoot, paperRel);

  return {
    slug,
    path: paperRel,
    title: String(data.title ?? slug),
    docType: docTypeFromIndex(data),
    journal: String(data.journal ?? ""),
    status: String(data.status ?? "Planning"),
    lastExport: data.last_export ? String(data.last_export) : null,
    tags: normalizeManuscriptTags(data.tags),
    project: normalizeProjectSlug(data.project),
    counts,
  };
}

export async function listManuscripts(
  modelRoot: string,
  options: ListManuscriptsOptions = {},
): Promise<ManuscriptSummary[]> {
  const papersDir = path.join(modelRoot, "papers");
  if (!existsSync(papersDir)) return [];

  const entries = await readdir(papersDir, { withFileTypes: true });
  const papers: ManuscriptSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summary = await parseManuscriptSummary(modelRoot, `papers/${entry.name}`);
    if (!summary) continue;
    if (options.docType && summary.docType !== options.docType) continue;
    if (options.tag) {
      const tag = options.tag.trim().toLowerCase();
      if (!summary.tags.includes(tag)) continue;
    }
    papers.push(summary);
  }
  return papers.sort((a, b) => a.title.localeCompare(b.title));
}

/** @deprecated Use listManuscripts */
export async function listPapers(modelRoot: string, options?: ListManuscriptsOptions): Promise<PaperSummary[]> {
  return listManuscripts(modelRoot, options);
}

export async function getManuscriptDetail(modelRoot: string, slug: string): Promise<ManuscriptDetail> {
  const paperRel = resolvePaperRel(modelRoot, slug);
  const summary = await parseManuscriptSummary(modelRoot, paperRel);
  if (!summary) {
    throw new ModelFsError(`Manuscript not found: ${slug}`, 404);
  }

  const indexPath = path.join(modelRoot, paperRel, "INDEX.md");
  const parsed = matter(await readFile(indexPath, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  const affiliations = normalizeAffiliations(data.affiliations);
  const authorDetails = normalizeAuthors(data.authors, affiliations.length, data.author_affiliations);
  // Back-compat derived views for older consumers / export fallbacks.
  const authors = authorDetails.map((a) => authorFullName(a));
  const authorAffiliations = authorDetails.map((a) => a.affiliations);
  const targetWords = Number(data.target_words ?? 5000);
  const sectionOrder = paperSectionOrder(data);
  const overleafRepoPath = data.overleaf_repo_path ? String(data.overleaf_repo_path) : null;
  const overleafGitUrl = data.overleaf_git_url ? String(data.overleaf_git_url) : null;

  const containerCounts = await collectContainerCounts(modelRoot, paperRel);
  const containerWordCounts = await collectContainerWordCounts(modelRoot, paperRel);

  const sections: SectionRollup[] = [];
  for (const section of await topLevelSections(modelRoot, paperRel)) {
    if (!existsSync(path.join(modelRoot, section.path))) continue;
    sections.push({
      path: section.path,
      title: section.title,
      counts: await countUnitsUnder(modelRoot, section.path),
      draftWordCount: containerWordCounts[section.path] ?? 0,
    });
  }

  const pendingReviews = await collectPendingReviewItems(modelRoot, paperRel);
  const pendingApprovalPaths = pendingReviews.map((item) => item.path);

  let draftWordCount = 0;
  try {
    const { markdown } = await buildCombinedMarkdown(modelRoot, paperRel, true);
    draftWordCount = countMarkdownWords(markdown);
  } catch {
    draftWordCount = 0;
  }

  const templateId = data.template_id ? String(data.template_id) : null;
  let templateLabel: string | null = null;
  if (templateId) {
    try {
      templateLabel = (await loadTemplate(modelRoot, templateId)).label;
    } catch {
      templateLabel = null;
    }
  }

  return {
    ...summary,
    templateId,
    templateLabel,
    authorDetails,
    authors,
    affiliations,
    authorAffiliations,
    targetWords,
    draftWordCount,
    sectionOrder,
    overleafRepoPath,
    overleafGitUrl,
    funder: data.funder ? String(data.funder) : null,
    program: data.program ? String(data.program) : null,
    deadline: data.deadline ? String(data.deadline) : null,
    audience: data.audience ? String(data.audience) : null,
    contributionMode: contributionModeFromIndex(data),
    agentSummary: data.agent_summary ? String(data.agent_summary) : null,
    sections,
    containerCounts,
    containerWordCounts,
    pendingApprovalPaths,
    pendingReviews,
  };
}

/** @deprecated Use getManuscriptDetail */
export async function getPaperDetail(modelRoot: string, slug: string): Promise<PaperDetail> {
  return getManuscriptDetail(modelRoot, slug);
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
