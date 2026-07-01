import crypto from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";

import { parseBibtex, parseBibtexWithSpans, type ParsedBibEntry } from "./bibtexImport.js";
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
  missingFromLibrary?: boolean;
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

type MainBibCache = {
  mtimeMs: number;
  entries: BibLibraryEntry[];
  byCiteKey: Map<string, BibLibraryEntry>;
  references: BibReferenceMetadata[];
  searchHaystacks: string[];
  counts: { verified: number; stale: number; unverified: number };
  entryOffsets: Map<string, { start: number; end: number }>;
};

function entrySearchHaystack(entry: BibLibraryEntry): string {
  return [
    entry.citeKey,
    entry.type,
    entry.fields.title,
    entry.fields.author,
    entry.fields.authors,
    entry.fields.year,
    entry.fields.journal,
    entry.fields.doi,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function referenceFromEntry(entry: BibLibraryEntry): BibReferenceMetadata {
  return {
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
  };
}

function buildMainBibCache(raw: string, mtimeMs: number): MainBibCache {
  const parsed = parseBibtexWithSpans(raw);
  const entries: BibLibraryEntry[] = [];
  const byCiteKey = new Map<string, BibLibraryEntry>();
  const entryOffsets = new Map<string, { start: number; end: number }>();
  const counts = { verified: 0, stale: 0, unverified: 0 };

  for (const { entry, sourceStart, sourceEnd } of parsed) {
    const enriched = enrichEntry(entry);
    entries.push(enriched);
    byCiteKey.set(enriched.citeKey, enriched);
    entryOffsets.set(enriched.citeKey, { start: sourceStart, end: sourceEnd });
    counts[enriched.verifiedStatus] += 1;
  }

  const pairs = entries.map((entry) => ({
    reference: referenceFromEntry(entry),
    haystack: entrySearchHaystack(entry),
  }));
  pairs.sort((a, b) => a.reference.citeKey.localeCompare(b.reference.citeKey));

  return {
    mtimeMs,
    entries,
    byCiteKey,
    references: pairs.map((p) => p.reference),
    searchHaystacks: pairs.map((p) => p.haystack),
    counts,
    entryOffsets,
  };
}

const mainBibCache = new Map<string, MainBibCache>();

export function invalidateMainBibCache(modelRoot?: string): void {
  if (modelRoot) {
    mainBibCache.delete(modelRoot);
    return;
  }
  mainBibCache.clear();
}

async function readMainBibEntriesCached(modelRoot: string): Promise<BibLibraryEntry[]> {
  const abs = mainBibPath(modelRoot);
  if (!existsSync(abs)) return [];
  const fileStat = await stat(abs);
  const cached = mainBibCache.get(modelRoot);
  if (cached && cached.mtimeMs === fileStat.mtimeMs) return cached.entries;
  const raw = await readFile(abs, "utf8");
  const next = buildMainBibCache(raw, fileStat.mtimeMs);
  mainBibCache.set(modelRoot, next);
  return next.entries;
}

async function getMainBibCache(modelRoot: string): Promise<MainBibCache | null> {
  await readMainBibEntriesCached(modelRoot);
  return mainBibCache.get(modelRoot) ?? null;
}

export async function readMainBibEntries(modelRoot: string): Promise<BibLibraryEntry[]> {
  return readMainBibEntriesCached(modelRoot);
}

export type MainBibSummary = {
  total: number;
  verified: number;
  stale: number;
  unverified: number;
  mtime: number | null;
};

export async function getMainBibSummary(modelRoot: string): Promise<MainBibSummary> {
  const abs = mainBibPath(modelRoot);
  if (!existsSync(abs)) {
    return { total: 0, verified: 0, stale: 0, unverified: 0, mtime: null };
  }
  const fileStat = await stat(abs);
  const cache = await getMainBibCache(modelRoot);
  return {
    total: cache?.entries.length ?? 0,
    verified: cache?.counts.verified ?? 0,
    stale: cache?.counts.stale ?? 0,
    unverified: cache?.counts.unverified ?? 0,
    mtime: fileStat.mtimeMs,
  };
}

export async function searchMainBibReferences(
  modelRoot: string,
  options: BibSearchOptions = {},
): Promise<{ entries: BibReferenceMetadata[]; total: number }> {
  const cache = await getMainBibCache(modelRoot);
  if (!cache) return { entries: [], total: 0 };

  const q = (options.q ?? "").trim().toLowerCase();
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(500, Math.max(1, options.limit ?? 80));
  const status = options.status ?? "all";

  let matched: BibReferenceMetadata[];
  if (!q && status === "all") {
    matched = cache.references;
  } else {
    matched = [];
    for (let i = 0; i < cache.references.length; i += 1) {
      const reference = cache.references[i]!;
      if (status !== "all" && reference.verifiedStatus !== status) continue;
      if (q && !cache.searchHaystacks[i]!.includes(q)) continue;
      matched.push(reference);
    }
  }

  return {
    entries: matched.slice(offset, offset + limit),
    total: matched.length,
  };
}

export type BibSearchOptions = {
  q?: string;
  offset?: number;
  limit?: number;
  status?: BibVerificationStatus | "all";
};

export async function getMainBibEntry(
  modelRoot: string,
  citeKey: string,
): Promise<BibLibraryEntry & { sourceRange?: { start: number; end: number } }> {
  const cache = await getMainBibCache(modelRoot);
  const entry = cache?.byCiteKey.get(citeKey);
  if (!entry) throw new ModelFsError(`BibTeX entry not found: ${citeKey}`, 404);
  const sourceRange = cache?.entryOffsets.get(citeKey);
  return sourceRange ? { ...entry, sourceRange } : entry;
}

/** Ensure model/main.bib exists and return its raw contents for the file API. */
export async function materializeMainBib(modelRoot: string): Promise<string> {
  const abs = mainBibPath(modelRoot);
  if (!existsSync(abs)) {
    await mkdir(modelRoot, { recursive: true });
    await writeFile(abs, "", "utf8");
    return "";
  }
  return readFile(abs, "utf8");
}

async function writeMainBibEntries(modelRoot: string, entries: ParsedBibEntry[]): Promise<void> {
  await mkdir(modelRoot, { recursive: true });
  const abs = mainBibPath(modelRoot);
  const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, dumpBibtex(entries), "utf8");
  await rename(tmp, abs);
  invalidateMainBibCache(modelRoot);
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
    fields: { ...entries[index].fields, ...patch.fields },
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

export async function deleteMainBibEntries(
  modelRoot: string,
  citeKeys: string[],
): Promise<{ deleted: string[]; missing: string[] }> {
  const wanted = [...new Set(citeKeys.map((key) => key.trim()).filter(Boolean))];
  if (wanted.length === 0) throw new ModelFsError("citeKeys required", 400);

  const entries = await readMainBibEntries(modelRoot);
  const existing = new Set(entries.map((entry) => entry.citeKey));
  const deleted = wanted.filter((key) => existing.has(key));
  const missing = wanted.filter((key) => !existing.has(key));
  const remove = new Set(deleted);
  const remaining = entries
    .filter((entry) => !remove.has(entry.citeKey))
    .map(({ verifiedStatus, integrity, ...entry }) => entry);
  await writeMainBibEntries(modelRoot, remaining);
  return { deleted, missing };
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

export function normalizeDoi(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

export function looksLikeDoi(value: string | null | undefined): boolean {
  const normalized = normalizeDoi(value);
  return /^10\.\d{4,}\/[^\s]+$/i.test(normalized);
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

async function fetchCrossrefWorkByDoi(doi: string): Promise<Record<string, unknown>> {
  const normalized = normalizeDoi(doi);
  if (!normalized) throw new ModelFsError("doi is required", 400);
  const response = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(normalized)}`,
    { headers: CROSSREF_HEADERS },
  );
  if (response.status === 404) throw new ModelFsError(`DOI not found: ${normalized}`, 404);
  if (!response.ok) throw new ModelFsError(`Crossref lookup failed: ${response.status}`, 502);
  const data = (await response.json()) as { message?: Record<string, unknown> };
  if (!data.message) throw new ModelFsError(`DOI not found: ${normalized}`, 404);
  return data.message;
}

export async function searchCrossrefCandidates(query: string, rows = 5): Promise<CrossrefCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) throw new ModelFsError("title is required", 400);
  if (looksLikeDoi(trimmed)) {
    const work = await fetchCrossrefWorkByDoi(trimmed);
    const candidate = candidateFromCrossref(work, firstString(work.title));
    return [{ ...candidate, similarity: 1 }];
  }
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

export async function previewNewBibEntryFromCrossref(
  modelRoot: string,
  doi: string,
): Promise<BibLibraryEntry> {
  const bibtex = await fetchCrossrefBibtex(doi);
  const [freshRaw] = parseBibtex(bibtex);
  if (!freshRaw) throw new ModelFsError("Crossref returned unparseable BibTeX", 502);
  const fresh = normalizeEntry(freshRaw);
  fresh.fields[INTEGRITY_FIELD] = integrityHash(fresh);
  return enrichEntry(fresh);
}

export async function addMainBibEntryFromCrossref(
  modelRoot: string,
  doi: string,
): Promise<{ entry: BibLibraryEntry; created: boolean }> {
  const bibtex = await fetchCrossrefBibtex(doi);
  const result = await importMainBibtex(modelRoot, bibtex);
  if (result.created.length > 0) {
    const entry = await markMainBibEntryVerified(modelRoot, result.created[0]!);
    return { entry, created: true };
  }
  if (result.skipped.length > 0) {
    const entry = await getMainBibEntry(modelRoot, result.skipped[0]!);
    return { entry, created: false };
  }
  throw new ModelFsError(result.errors[0] ?? "Could not add BibTeX entry from Crossref", 502);
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
