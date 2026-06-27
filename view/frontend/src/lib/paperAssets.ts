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
  citeKey: string | null;
  authors: string | null;
  year: string | null;
  journal: string | null;
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

export async function importReferencesFromBibtex(
  paperPath: string,
  bibtex: string,
): Promise<BibtexImportResult> {
  return request<BibtexImportResult>("/api/model/references/import", {
    method: "POST",
    body: JSON.stringify({ paper: paperPath, bibtex }),
  });
}
