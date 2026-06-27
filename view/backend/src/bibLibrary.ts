import crypto from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { parseBibtex, type ParsedBibEntry } from "./bibtexImport.js";
import { ModelFsError } from "./modelFs.js";

export const MAIN_BIB_FILE = "main.bib";
export const INTEGRITY_FIELD = "integrity";

export type BibVerificationStatus = "verified" | "stale" | "unverified";

export type BibLibraryEntry = ParsedBibEntry & {
  verifiedStatus: BibVerificationStatus;
  integrity: string | null;
};

export type BibReferenceMetadata = {
  path: string;
  title: string;
  citeKey: string;
  authors: string | null;
  year: string | null;
  journal: string | null;
  doi: string | null;
  type: string;
  verifiedStatus: BibVerificationStatus;
  integrity: string | null;
};

export type CrossrefCandidate = {
  doi: string;
  title: string;
  authors: string;
  year: string | null;
  journal: string | null;
  similarity: number;
};

function mainBibPath(modelRoot: string): string {
  return path.join(modelRoot, MAIN_BIB_FILE);
}

function sortedObject(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(input).sort()) out[key] = input[key];
  return out;
}

export function integrityPayload(entry: ParsedBibEntry): Record<string, string> {
  return sortedObject({
    ENTRYTYPE: entry.type,
    ...Object.fromEntries(
      Object.entries(entry.fields).filter(([key]) => key.toLowerCase() !== INTEGRITY_FIELD),
    ),
  });
}

export function integrityHash(entry: ParsedBibEntry): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(integrityPayload(entry)))
    .digest("hex");
}

export function verificationStatus(entry: ParsedBibEntry): BibVerificationStatus {
  const stored = entry.fields[INTEGRITY_FIELD]?.trim() ?? "";
  if (!stored) return "unverified";
  return stored === integrityHash(entry) ? "verified" : "stale";
}

function enrichEntry(entry: ParsedBibEntry): BibLibraryEntry {
  return {
    ...entry,
    verifiedStatus: verificationStatus(entry),
    integrity: entry.fields[INTEGRITY_FIELD] ?? null,
  };
}

function formatFieldValue(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function entryToBibtex(entry: ParsedBibEntry): string {
  const fields = sortedObject(entry.fields);
  const lines = [`@${entry.type}{${entry.citeKey},`];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(`  ${key} = {${formatFieldValue(value)}},`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function dumpBibtex(entries: ParsedBibEntry[]): string {
  return entries.map(entryToBibtex).join("\n\n").trimEnd() + (entries.length ? "\n" : "");
}

export async function readMainBibEntries(modelRoot: string): Promise<BibLibraryEntry[]> {
  const abs = mainBibPath(modelRoot);
  if (!existsSync(abs)) return [];
  return parseBibtex(await readFile(abs, "utf8")).map(enrichEntry);
}

async function writeMainBibEntries(modelRoot: string, entries: ParsedBibEntry[]): Promise<void> {
  await mkdir(modelRoot, { recursive: true });
  await writeFile(mainBibPath(modelRoot), dumpBibtex(entries), "utf8");
}

function sanitizeCiteKey(citeKey: string): string {
  return (
    citeKey
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ref"
  );
}

function normalizeEntry(entry: ParsedBibEntry): ParsedBibEntry {
  const fields = Object.fromEntries(
    Object.entries(entry.fields)
      .map(([key, value]) => [key.trim().toLowerCase(), String(value ?? "").trim()])
      .filter(([key, value]) => key && value),
  );
  return {
    type: entry.type.trim().toLowerCase() || "article",
    citeKey: sanitizeCiteKey(entry.citeKey),
    fields,
  };
}

export async function importMainBibtex(
  modelRoot: string,
  bibtex: string,
): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
  const existing = await readMainBibEntries(modelRoot);
  const existingKeys = new Set(existing.map((entry) => entry.citeKey));
  const parsed = parseBibtex(bibtex).map(normalizeEntry);
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  if (parsed.length === 0) {
    return { created, skipped, errors: ["No BibTeX entries found"] };
  }

  const next: ParsedBibEntry[] = existing.map(({ verifiedStatus, integrity, ...entry }) => entry);
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (seen.has(entry.citeKey) || existingKeys.has(entry.citeKey)) {
      skipped.push(entry.citeKey);
      continue;
    }
    seen.add(entry.citeKey);
    next.push(entry);
    created.push(entry.citeKey);
  }

  await writeMainBibEntries(modelRoot, next);
  return { created, skipped, errors };
}

export async function updateMainBibEntry(
  modelRoot: string,
  citeKey: string,
  patch: { type?: string; nextCiteKey?: string; fields: Record<string, string> },
): Promise<BibLibraryEntry> {
  const entries = await readMainBibEntries(modelRoot);
  const index = entries.findIndex((entry) => entry.citeKey === citeKey);
  if (index === -1) throw new ModelFsError(`BibTeX entry not found: ${citeKey}`, 404);

  const nextKey = sanitizeCiteKey(patch.nextCiteKey ?? citeKey);
  if (nextKey !== citeKey && entries.some((entry) => entry.citeKey === nextKey)) {
    throw new ModelFsError(`BibTeX entry already exists: ${nextKey}`, 409);
  }

  const normalized = normalizeEntry({
    type: patch.type ?? entries[index].type,
    citeKey: nextKey,
    fields: patch.fields,
  });
  entries[index] = enrichEntry(normalized);
  await writeMainBibEntries(modelRoot, entries);
  return entries[index];
}

export async function markMainBibEntryVerified(
  modelRoot: string,
  citeKey: string,
): Promise<BibLibraryEntry> {
  const entries = await readMainBibEntries(modelRoot);
  const index = entries.findIndex((entry) => entry.citeKey === citeKey);
  if (index === -1) throw new ModelFsError(`BibTeX entry not found: ${citeKey}`, 404);
  const entry = normalizeEntry(entries[index]);
  entry.fields[INTEGRITY_FIELD] = integrityHash(entry);
  entries[index] = enrichEntry(entry);
  await writeMainBibEntries(modelRoot, entries);
  return entries[index];
}

export function referencesFromBibEntries(entries: BibLibraryEntry[]): BibReferenceMetadata[] {
  return entries
    .map((entry) => ({
      path: `${MAIN_BIB_FILE}#${entry.citeKey}`,
      title: entry.fields.title || entry.citeKey,
      citeKey: entry.citeKey,
      authors: entry.fields.author ?? entry.fields.authors ?? null,
      year: entry.fields.year ?? entry.fields.date ?? null,
      journal: entry.fields.journal ?? entry.fields.booktitle ?? entry.fields.publisher ?? null,
      doi: entry.fields.doi ?? null,
      type: entry.type,
      verifiedStatus: entry.verifiedStatus,
      integrity: entry.integrity,
    }))
    .sort((a, b) => a.citeKey.localeCompare(b.citeKey));
}

export async function listMainBibReferences(modelRoot: string): Promise<BibReferenceMetadata[]> {
  return referencesFromBibEntries(await readMainBibEntries(modelRoot));
}

export async function bibtexForCiteKeys(modelRoot: string, citeKeys: Set<string>): Promise<string> {
  if (citeKeys.size === 0) return "";
  const entries = await readMainBibEntries(modelRoot);
  const selected = entries.filter((entry) => citeKeys.has(entry.citeKey));
  return dumpBibtex(selected);
}

function normalizeDoi(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function normalizeTitle(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[{}\\]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleSimilarity(left: string | null | undefined, right: string | null | undefined): number {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return 0;
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function crossrefAuthors(work: Record<string, unknown>): string {
  const authors = Array.isArray(work.author) ? work.author : [];
  return authors
    .slice(0, 12)
    .map((raw) => {
      const author = raw as Record<string, unknown>;
      return [author.given, author.family].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" and ");
}

function crossrefYear(work: Record<string, unknown>): string | null {
  const issued = work.issued as { "date-parts"?: unknown } | undefined;
  const parts = issued?.["date-parts"];
  if (Array.isArray(parts) && Array.isArray(parts[0]) && parts[0][0]) return String(parts[0][0]);
  return null;
}

function firstString(value: unknown): string {
  return Array.isArray(value) && value.length > 0 ? String(value[0] ?? "") : String(value ?? "");
}

function candidateFromCrossref(work: Record<string, unknown>, queryTitle: string): CrossrefCandidate {
  const title = firstString(work.title);
  return {
    doi: normalizeDoi(String(work.DOI ?? "")),
    title,
    authors: crossrefAuthors(work),
    year: crossrefYear(work),
    journal: firstString(work["container-title"]) || null,
    similarity: titleSimilarity(queryTitle, title),
  };
}

const CROSSREF_HEADERS = {
  "User-Agent": "treewriter-bib-library/0.1 (mailto:metadata@example.invalid)",
};

export async function searchCrossrefCandidates(title: string, rows = 5): Promise<CrossrefCandidate[]> {
  const trimmed = title.trim();
  if (!trimmed) throw new ModelFsError("title is required", 400);
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.title", trimmed);
  url.searchParams.set("rows", String(Math.max(1, Math.min(rows, 10))));
  const response = await fetch(url, { headers: CROSSREF_HEADERS });
  if (!response.ok) throw new ModelFsError(`Crossref search failed: ${response.status}`, 502);
  const data = (await response.json()) as { message?: { items?: Record<string, unknown>[] } };
  return (data.message?.items ?? []).map((work) => candidateFromCrossref(work, trimmed));
}

async function fetchCrossrefBibtex(doi: string): Promise<string> {
  const normalized = normalizeDoi(doi);
  if (!normalized) throw new ModelFsError("doi is required", 400);
  const response = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(normalized)}/transform/application/x-bibtex`,
    { headers: CROSSREF_HEADERS },
  );
  if (!response.ok) throw new ModelFsError(`Crossref BibTeX fetch failed: ${response.status}`, 502);
  return response.text();
}

async function crossrefReplacementEntry(
  modelRoot: string,
  citeKey: string,
  doi: string,
): Promise<{ entries: BibLibraryEntry[]; index: number; fresh: BibLibraryEntry }> {
  const entries = await readMainBibEntries(modelRoot);
  const index = entries.findIndex((entry) => entry.citeKey === citeKey);
  if (index === -1) throw new ModelFsError(`BibTeX entry not found: ${citeKey}`, 404);
  const oldEntry = entries[index];
  const bibtex = await fetchCrossrefBibtex(doi);
  const [freshRaw] = parseBibtex(bibtex);
  if (!freshRaw) throw new ModelFsError("Crossref returned unparseable BibTeX", 502);
  const fresh = normalizeEntry({ ...freshRaw, citeKey: oldEntry.citeKey });
  fresh.fields[INTEGRITY_FIELD] = integrityHash(fresh);
  return { entries, index, fresh: enrichEntry(fresh) };
}

export async function previewMainBibEntryFromCrossref(
  modelRoot: string,
  citeKey: string,
  doi: string,
): Promise<BibLibraryEntry> {
  return (await crossrefReplacementEntry(modelRoot, citeKey, doi)).fresh;
}

export async function updateMainBibEntryFromCrossref(
  modelRoot: string,
  citeKey: string,
  doi: string,
): Promise<BibLibraryEntry> {
  const { entries, index, fresh } = await crossrefReplacementEntry(modelRoot, citeKey, doi);
  entries[index] = fresh;
  await writeMainBibEntries(modelRoot, entries);
  return entries[index];
}
