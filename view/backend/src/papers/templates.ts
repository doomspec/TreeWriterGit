import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError } from "../modelFs.js";
import { parseJournalExportStyle, type JournalExportStyle } from "../journalExportStyle.js";

export interface JournalTemplate {
  journal: string;
  targetWords: number;
  sectionOrder: string[];
  export?: JournalExportStyle;
}

function journalFileKey(journal: string): string {
  return journal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
