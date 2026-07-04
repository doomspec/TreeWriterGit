import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError } from "../modelFs.js";
import { parseJournalExportStyle, type JournalExportStyle } from "../journalExportStyle.js";
import type { DocumentType, ExportPrimaryFormat, ManuscriptTemplate } from "@treewriter/shared";

export type { ManuscriptTemplate };

/** Legacy alias — journal field always present when loaded via loadJournalTemplate */
export type JournalTemplate = ManuscriptTemplate & { journal: string };

const DEFAULT_PAPER_STATUSES = ["Planning", "Drafting", "Reviewing", "Submitted", "Published"];
const DEFAULT_GRANT_STATUSES = ["Planning", "Drafting", "Internal review", "Submitted", "Awarded", "Declined"];
const DEFAULT_REPORT_STATUSES = ["Planning", "Drafting", "Review", "Final", "Archived"];

const DEFAULT_ASSET_DIRS = ["figures", "tables", "equations"];
const DEFAULT_PAPER_NOTES = ["literature", "data", "feedback"];
const DEFAULT_GRANT_NOTES = ["literature", "budget", "compliance", "letters"];
const DEFAULT_REPORT_NOTES = ["literature", "data", "appendices"];

function templateFileKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseStringArray(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const values = raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return values.length > 0 ? values : fallback;
}

function defaultStatusOptions(docType: DocumentType): string[] {
  if (docType === "grant") return DEFAULT_GRANT_STATUSES;
  if (docType === "report") return DEFAULT_REPORT_STATUSES;
  return DEFAULT_PAPER_STATUSES;
}

function defaultNotesDirs(docType: DocumentType): string[] {
  if (docType === "grant") return DEFAULT_GRANT_NOTES;
  if (docType === "report") return DEFAULT_REPORT_NOTES;
  return DEFAULT_PAPER_NOTES;
}

function defaultAssetDirs(docType: DocumentType): string[] {
  return docType === "paper" ? DEFAULT_ASSET_DIRS : [];
}

function defaultPrimaryFormat(docType: DocumentType, exportBlock?: JournalExportStyle & { primaryFormat?: ExportPrimaryFormat }): ExportPrimaryFormat {
  if (exportBlock?.primaryFormat) return exportBlock.primaryFormat;
  return docType === "paper" ? "latex" : "docx";
}

function parseExportPrimaryFormat(raw: unknown): ExportPrimaryFormat | undefined {
  if (raw === "latex" || raw === "docx" || raw === "pdf") return raw;
  return undefined;
}

function parseManuscriptTemplateFromFile(
  filePath: string,
  fallbackId: string,
  parsed: matter.GrayMatterFile<string>,
): ManuscriptTemplate | null {
  const data = parsed.data as Record<string, unknown>;
  const sectionOrder = Array.isArray(data.section_order) ? (data.section_order as string[]) : [];
  if (sectionOrder.length === 0) return null;

  const templateId = String(data.template_id ?? fallbackId);
  const docTypeRaw = String(data.doc_type ?? "paper");
  const docType: DocumentType =
    docTypeRaw === "grant" || docTypeRaw === "report" ? docTypeRaw : "paper";
  const label = String(data.label ?? data.journal ?? templateId);
  const exportRaw = data.export as Record<string, unknown> | undefined;
  const exportStyle = parseJournalExportStyle(data.export);
  const primaryFormat = parseExportPrimaryFormat(exportRaw?.primary_format);

  return {
    templateId,
    docType,
    label,
    description: String(data.description ?? ""),
    journal: data.journal ? String(data.journal) : undefined,
    targetWords: Number(data.target_words ?? 5000),
    targetPages: data.target_pages != null ? Number(data.target_pages) : undefined,
    sectionOrder,
    statusOptions: parseStringArray(data.status_options, defaultStatusOptions(docType)),
    assetDirs: parseStringArray(data.asset_dirs, defaultAssetDirs(docType)),
    notesDirs: parseStringArray(data.notes_dirs, defaultNotesDirs(docType)),
    requiredFields: parseStringArray(data.required_fields, docType === "paper" ? ["journal"] : docType === "grant" ? ["funder"] : []),
    exportPrimaryFormat: defaultPrimaryFormat(docType, exportStyle ? { ...exportStyle, primaryFormat } : { primaryFormat }),
    // ManuscriptTemplate.export is a generic Record at the API boundary (shared
    // with the frontend); JournalExportStyle's fields are all unknown-compatible
    // but the interface has no index signature, so TS needs an explicit cast.
    export: exportStyle as Record<string, unknown> | undefined,
  };
}

async function readManuscriptTemplateFile(
  filePath: string,
  fallbackId: string,
): Promise<ManuscriptTemplate | null> {
  const parsed = matter(await readFile(filePath, "utf8"));
  return parseManuscriptTemplateFromFile(filePath, fallbackId, parsed);
}

export async function loadTemplate(
  modelRoot: string,
  templateId: string,
): Promise<ManuscriptTemplate> {
  const templatesDir = path.join(modelRoot, "templates");
  const key = templateFileKey(templateId);
  const filePath = path.join(templatesDir, `${key}.md`);
  if (!existsSync(filePath)) {
    throw new ModelFsError(`No template found for ${JSON.stringify(templateId)}`, 404);
  }
  const template = await readManuscriptTemplateFile(filePath, key);
  if (!template) {
    throw new ModelFsError(`Template ${JSON.stringify(templateId)} has no section_order`, 400);
  }
  return template;
}

export async function loadJournalTemplate(
  modelRoot: string,
  journal: string,
): Promise<ManuscriptTemplate & { journal: string }> {
  const templatesDir = path.join(modelRoot, "templates");
  const candidates = [
    path.join(templatesDir, `${templateFileKey(journal)}.md`),
    path.join(templatesDir, "plos-one.md"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const fallbackId = path.basename(filePath, ".md");
    const template = await readManuscriptTemplateFile(filePath, fallbackId);
    if (!template) continue;
    return {
      ...template,
      journal: template.journal ?? journal,
    };
  }

  throw new ModelFsError(`No journal template found for ${JSON.stringify(journal)}`, 404);
}

export type ListTemplatesOptions = {
  docType?: DocumentType;
};

export async function listManuscriptTemplates(
  modelRoot: string,
  options: ListTemplatesOptions = {},
): Promise<ManuscriptTemplate[]> {
  const templatesDir = path.join(modelRoot, "templates");
  if (!existsSync(templatesDir)) return [];
  const files = await readdir(templatesDir);
  const templates: ManuscriptTemplate[] = [];
  for (const file of files.filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")) {
    const fallbackId = file.replace(/\.md$/i, "");
    const template = await readManuscriptTemplateFile(path.join(templatesDir, file), fallbackId);
    if (!template) continue;
    if (options.docType && template.docType !== options.docType) continue;
    templates.push(template);
  }
  return templates.sort((a, b) => a.label.localeCompare(b.label));
}

/** @deprecated Use listManuscriptTemplates */
export async function listJournalTemplateDetails(modelRoot: string): Promise<(ManuscriptTemplate & { journal: string })[]> {
  return (await listManuscriptTemplates(modelRoot)).map((template) => ({
    ...template,
    journal: template.journal ?? template.label,
  }));
}

/** @deprecated Use listManuscriptTemplates */
export async function listJournalTemplates(modelRoot: string): Promise<string[]> {
  return (await listJournalTemplateDetails(modelRoot)).map((template) => template.journal);
}
