import type { FigureMetadata } from "@/lib/figures";
import { request } from "@/lib/apiClient";

export type TableMetadata = {
  kind: "table-unit" | "table-note";
  path: string;
  title: string;
  caption: string;
  summary: string | null;
  outlinePath: string | null;
  draftPath: string | null;
  tableLabel: string | null;
};

export type EquationMetadata = {
  kind: "equation-unit" | "equation-note";
  path: string;
  title: string;
  caption: string;
  summary: string | null;
  sourcePath: string | null;
  outlinePath: string | null;
  draftPath: string | null;
  equationLabel: string | null;
};

export type ReferenceMetadata = {
  path: string;
  title: string;
  citeKey: string;
  authors: string | null;
  year: string | null;
  journal: string | null;
  doi?: string | null;
  type?: string;
  verifiedStatus?: "verified" | "stale" | "unverified";
  integrity?: string | null;
  missingFromLibrary?: boolean;
};

export type PaperAssetsBundle = {
  figures: FigureMetadata[];
  tables: TableMetadata[];
  equations: EquationMetadata[];
  referenceCount: number;
};

export type CrossRefIndex = {
  figureLabels: Record<string, FigureMetadata>;
  tableLabels: Record<string, TableMetadata>;
};

export async function fetchPaperAssets(paperPath: string): Promise<PaperAssetsBundle> {
  return request<PaperAssetsBundle>(`/api/model/assets?paper=${encodeURIComponent(paperPath)}`);
}

export async function fetchCrossRefIndex(paperPath: string): Promise<CrossRefIndex> {
  return request<CrossRefIndex>(`/api/model/crossref-index?paper=${encodeURIComponent(paperPath)}`);
}

export async function fetchReferenceIndex(paperPath: string): Promise<ReferenceMetadata[]> {
  const data = await request<{ references: ReferenceMetadata[] }>(
    `/api/model/references/index?paper=${encodeURIComponent(paperPath)}`,
  );
  return data.references;
}

export async function fetchCitedReferences(paperPath: string): Promise<ReferenceMetadata[]> {
  const data = await request<{ references: ReferenceMetadata[] }>(
    `/api/model/references/cited?paper=${encodeURIComponent(paperPath)}`,
  );
  return data.references;
}

export async function removeCitationFromDrafts(
  paperPath: string,
  citeKey: string,
): Promise<{ modified: string[] }> {
  return request<{ modified: string[] }>("/api/model/references/remove-from-text", {
    method: "POST",
    body: JSON.stringify({ paper: paperPath, citeKey }),
  });
}

export function literatureNoteTemplate(title: string, citeKey: string): string {
  const safeTitle = title.replace(/"/g, '\\"');
  return `---
kind: note
type: literature
title: "${safeTitle}"
authors: ""
year: ${new Date().getFullYear()}
cite_key: "${citeKey}"
entry_type: article
relevance: []
---

# ${title}

## Summary

`;
}

export function slugifyAssetName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset"
  );
}

export type BibtexImportResult = {
  created: string[];
  skipped: string[];
  errors: string[];
};

export type BibLibraryEntry = {
  type: string;
  citeKey: string;
  fields: Record<string, string>;
  verifiedStatus: "verified" | "stale" | "unverified";
  integrity: string | null;
  sourceRange?: { start: number; end: number };
};

export type MainBibSummary = {
  total: number;
  verified: number;
  stale: number;
  unverified: number;
  mtime: number | null;
};

export type BibSearchResponse = {
  entries: ReferenceMetadata[];
  total: number;
};

export type CrossrefCandidate = {
  doi: string;
  title: string;
  authors: string;
  year: string | null;
  journal: string | null;
  similarity: number;
};

export async function importReferencesFromBibtex(
  paperPath: string,
  bibtex: string,
): Promise<BibtexImportResult> {
  return request<BibtexImportResult>("/api/model/references/import", {
    method: "POST",
    body: JSON.stringify({ paper: paperPath, bibtex }),
  });
}

export async function fetchBibLibrary(): Promise<BibLibraryEntry[]> {
  const data = await request<{ entries: BibLibraryEntry[] }>("/api/model/bib");
  return data.entries;
}

export async function fetchBibLibrarySummary(): Promise<MainBibSummary> {
  return request<MainBibSummary>("/api/model/bib/summary");
}

export async function fetchBibSearch(options: {
  q?: string;
  offset?: number;
  limit?: number;
  status?: "all" | "verified" | "stale" | "unverified";
}): Promise<BibSearchResponse> {
  const params = new URLSearchParams();
  if (options.q?.trim()) params.set("q", options.q.trim());
  if (options.offset != null) params.set("offset", String(options.offset));
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.status && options.status !== "all") params.set("status", options.status);
  const query = params.toString();
  return request<BibSearchResponse>(`/api/model/bib/search${query ? `?${query}` : ""}`);
}

export async function fetchBibEntry(citeKey: string): Promise<BibLibraryEntry> {
  const data = await request<{ entry: BibLibraryEntry }>(
    `/api/model/bib/entry/${encodeURIComponent(citeKey)}`,
  );
  return data.entry;
}

export async function saveBibEntry(
  citeKey: string,
  body: { nextCiteKey?: string; type?: string; fields: Record<string, string> },
): Promise<BibLibraryEntry> {
  const data = await request<{ entry: BibLibraryEntry }>("/api/model/bib/entry", {
    method: "PUT",
    body: JSON.stringify({ citeKey, ...body }),
  });
  return data.entry;
}

export async function verifyBibEntry(citeKey: string): Promise<BibLibraryEntry> {
  const data = await request<{ entry: BibLibraryEntry }>("/api/model/bib/verify", {
    method: "POST",
    body: JSON.stringify({ citeKey }),
  });
  return data.entry;
}

export async function deleteBibEntries(
  citeKeys: string[],
): Promise<{ deleted: string[]; missing: string[] }> {
  return request<{ deleted: string[]; missing: string[] }>("/api/model/bib/delete", {
    method: "POST",
    body: JSON.stringify({ citeKeys }),
  });
}

export async function searchCrossrefForBibEntry(
  title: string,
): Promise<CrossrefCandidate[]> {
  const data = await request<{ candidates: CrossrefCandidate[] }>("/api/model/bib/crossref/search", {
    method: "POST",
    body: JSON.stringify({ title, rows: 5 }),
  });
  return data.candidates;
}

export async function updateBibEntryFromCrossref(
  citeKey: string,
  doi: string,
): Promise<BibLibraryEntry> {
  const data = await request<{ entry: BibLibraryEntry }>("/api/model/bib/crossref/update", {
    method: "POST",
    body: JSON.stringify({ citeKey, doi }),
  });
  return data.entry;
}

export async function previewBibEntryFromCrossref(
  citeKey: string,
  doi: string,
): Promise<BibLibraryEntry> {
  const data = await request<{ entry: BibLibraryEntry }>("/api/model/bib/crossref/preview", {
    method: "POST",
    body: JSON.stringify({ citeKey, doi }),
  });
  return data.entry;
}

export async function previewNewBibEntryFromCrossref(doi: string): Promise<BibLibraryEntry> {
  const data = await request<{ entry: BibLibraryEntry }>("/api/model/bib/crossref/preview-new", {
    method: "POST",
    body: JSON.stringify({ doi }),
  });
  return data.entry;
}

export async function addBibEntryFromCrossref(
  doi: string,
): Promise<{ entry: BibLibraryEntry; created: boolean }> {
  return request<{ entry: BibLibraryEntry; created: boolean }>("/api/model/bib/crossref/add", {
    method: "POST",
    body: JSON.stringify({ doi }),
  });
}

export type ZoteroSearchHit = {
  itemKey: string;
  title: string;
  authors: string | null;
  year: string | null;
  doi: string | null;
  citeKey: string | null;
  itemType: string | null;
};

export type ZoteroImportResult = BibtexImportResult & {
  citeKeys: string[];
};

export async function searchZoteroLocal(
  query: string,
  limit = 20,
): Promise<ZoteroSearchHit[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const data = await request<{ hits: ZoteroSearchHit[] }>(`/api/zotero/local/search?${params}`);
  return data.hits;
}

export async function importZoteroLocalItems(itemKeys: string[]): Promise<ZoteroImportResult> {
  return request<ZoteroImportResult>("/api/zotero/local/import", {
    method: "POST",
    body: JSON.stringify({ itemKeys }),
  });
}
