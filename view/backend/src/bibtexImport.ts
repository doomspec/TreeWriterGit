import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { paperLiteratureDir } from "./paperAssets.js";

export type ParsedBibEntry = {
  type: string;
  citeKey: string;
  fields: Record<string, string>;
};

export type BibtexImportResult = {
  created: string[];
  skipped: string[];
  errors: string[];
};

function unescapeBibValue(value: string): string {
  return value.replace(/\\([#%&_{}])/g, "$1").trim();
}

/** Read a brace-delimited or quoted BibTeX value starting at `start`. */
function readBibValue(source: string, start: number): { value: string; end: number } | null {
  const first = source[start];
  if (first === "{") {
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return { value: unescapeBibValue(source.slice(start + 1, i)), end: i + 1 };
        }
      }
    }
    return null;
  }
  if (first === '"') {
    for (let i = start + 1; i < source.length; i += 1) {
      if (source[i] === '"' && source[i - 1] !== "\\") {
        return { value: unescapeBibValue(source.slice(start + 1, i)), end: i + 1 };
      }
    }
    return null;
  }
  const end = source.slice(start).search(/[\s,}]/);
  const raw = end === -1 ? source.slice(start) : source.slice(start, start + end);
  return { value: unescapeBibValue(raw), end: start + (end === -1 ? raw.length : end) };
}

/** Parse BibTeX source into entries (common .bib files). */
export function parseBibtex(source: string): ParsedBibEntry[] {
  const entries: ParsedBibEntry[] = [];
  const text = source.replace(/\r\n/g, "\n");
  let index = 0;

  while (index < text.length) {
    const at = text.indexOf("@", index);
    if (at === -1) break;

    let cursor = at + 1;
    while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;

    const typeStart = cursor;
    while (cursor < text.length && /[a-zA-Z]/.test(text[cursor] ?? "")) cursor += 1;
    const type = text.slice(typeStart, cursor).trim().toLowerCase();
    if (!type || type === "comment" || type === "preamble" || type === "string") {
      index = cursor + 1;
      continue;
    }

    while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;
    if (text[cursor] !== "{") {
      index = cursor + 1;
      continue;
    }
    cursor += 1;

    while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;
    const keyStart = cursor;
    while (cursor < text.length && !/[\s,}]/.test(text[cursor] ?? "")) cursor += 1;
    const citeKey = text.slice(keyStart, cursor).trim();
    if (!citeKey) {
      index = cursor + 1;
      continue;
    }

    const fields: Record<string, string> = {};
    while (cursor < text.length) {
      while (cursor < text.length && /[\s,]/.test(text[cursor] ?? "")) cursor += 1;
      if (text[cursor] === "}") break;

      const fieldStart = cursor;
      while (cursor < text.length && text[cursor] !== "=") cursor += 1;
      if (text[cursor] !== "=") break;

      const fieldName = text.slice(fieldStart, cursor).trim().toLowerCase();
      cursor += 1;
      while (cursor < text.length && /\s/.test(text[cursor] ?? "")) cursor += 1;

      const valueRead = readBibValue(text, cursor);
      if (!valueRead) break;
      fields[fieldName] = valueRead.value;
      cursor = valueRead.end;
    }

    entries.push({ type, citeKey, fields });
    index = cursor + 1;
  }

  return entries;
}

function extractYear(fields: Record<string, string>): number | null {
  const raw = fields.year ?? fields.date ?? "";
  const match = raw.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function sanitizeCiteKey(citeKey: string): string {
  return citeKey
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ref";
}

export function literatureNoteFromBibEntry(entry: ParsedBibEntry): string {
  const citeKey = sanitizeCiteKey(entry.citeKey);
  const title = entry.fields.title?.trim() || citeKey;
  const authors = (entry.fields.author ?? entry.fields.authors ?? "").trim();
  const year = extractYear(entry.fields);
  const journal = (
    entry.fields.journal ??
    entry.fields.booktitle ??
    entry.fields.publisher ??
    ""
  ).trim();
  const doi = entry.fields.doi?.trim() ?? "";
  const abstract = entry.fields.abstract?.trim() ?? "";

  const frontmatter: Record<string, unknown> = {
    kind: "note",
    type: "literature",
    title,
    cite_key: citeKey,
  };
  if (authors) frontmatter.authors = authors;
  if (year !== null) frontmatter.year = year;
  if (journal) frontmatter.journal = journal;
  if (doi) frontmatter.doi = doi;

  let body = `# ${title}\n\n`;
  if (authors) {
    body += `**Authors:** ${authors}${year !== null ? ` (${year})` : ""}\n`;
  }
  if (journal) body += `**Journal:** ${journal}\n`;
  body += "\n## Summary\n\n";
  if (abstract) body += `${abstract}\n`;

  return matter.stringify(body, frontmatter);
}

export async function importBibtexReferences(
  modelRoot: string,
  paperRel: string,
  bibtex: string,
  options?: { skipExisting?: boolean },
): Promise<BibtexImportResult> {
  const skipExisting = options?.skipExisting ?? true;
  const literatureDir = paperLiteratureDir(paperRel);
  const literatureAbs = path.join(modelRoot, literatureDir);
  await mkdir(literatureAbs, { recursive: true });

  const entries = parseBibtex(bibtex);
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  if (entries.length === 0) {
    errors.push("No BibTeX entries found");
    return { created, skipped, errors };
  }

  const seenKeys = new Set<string>();

  for (const entry of entries) {
    const citeKey = sanitizeCiteKey(entry.citeKey);
    if (seenKeys.has(citeKey)) {
      skipped.push(citeKey);
      continue;
    }
    seenKeys.add(citeKey);

    const noteRel = path.posix.join(literatureDir, `${citeKey}.md`);
    const noteAbs = path.join(modelRoot, noteRel);

    if (skipExisting && existsSync(noteAbs)) {
      skipped.push(citeKey);
      continue;
    }

    try {
      await writeFile(noteAbs, literatureNoteFromBibEntry({ ...entry, citeKey }), "utf8");
      created.push(noteRel);
    } catch (err) {
      errors.push(`${citeKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { created, skipped, errors };
}
