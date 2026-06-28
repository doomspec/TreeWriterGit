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
