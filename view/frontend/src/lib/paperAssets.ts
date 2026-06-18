import type { FigureMetadata } from "@/lib/figures";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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
  references: ReferenceMetadata[];
};

export async function fetchPaperAssets(paperPath: string): Promise<PaperAssetsBundle> {
  const res = await fetch(`${apiBaseUrl}/api/model/assets?paper=${encodeURIComponent(paperPath)}`);
  if (!res.ok) throw new Error(`Assets load failed (${res.status})`);
  return (await res.json()) as PaperAssetsBundle;
}

export function literatureNoteTemplate(title: string, citeKey: string): string {
  const safeTitle = title.replace(/"/g, '\\"');
  return `---
kind: "note"
type: "literature"
title: "${safeTitle}"
authors: ""
year: ${new Date().getFullYear()}
cite_key: "${citeKey}"
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
  const res = await fetch(`${apiBaseUrl}/api/model/references/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper: paperPath, bibtex }),
  });
  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Invalid JSON from API (${res.status})`);
    }
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Import failed (${res.status})`;
    throw new Error(message);
  }
  return body as BibtexImportResult;
}
