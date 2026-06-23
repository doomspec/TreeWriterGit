import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { listPaperEquations } from "./equations.js";
import { listPaperFigures } from "./figures.js";
import { indexSkeleton, outlineDocSkeleton } from "./modelFs.js";
import { listPaperTables } from "./tables.js";

export type ReferenceMetadata = {
  path: string;
  title: string;
  citeKey: string | null;
  authors: string | null;
  year: string | null;
  journal: string | null;
};

export type PaperAssetsBundle = {
  figures: Awaited<ReturnType<typeof listPaperFigures>>;
  tables: Awaited<ReturnType<typeof listPaperTables>>;
  equations: Awaited<ReturnType<typeof listPaperEquations>>;
  referenceCount: number;
};

export async function countPaperReferences(modelRoot: string, paperRel: string): Promise<number> {
  const literatureDir = paperLiteratureDir(paperRel);
  const abs = path.join(modelRoot, literatureDir);
  if (!existsSync(abs)) return 0;

  let count = 0;
  for (const file of await readdir(abs)) {
    if (!file.endsWith(".md") || file === "INDEX.md" || file === "outline.md" || file === "draft.md") {
      continue;
    }
    count += 1;
  }
  return count;
}

export function paperLiteratureDir(paperRel: string): string {
  return path.posix.join(paperRel, "notes/literature");
}

/** Ensure figures/ and tables/ container folders exist for a paper. */
export async function ensurePaperAssetContainers(
  modelRoot: string,
  paperRel: string,
): Promise<void> {
  for (const container of ["figures", "tables", "equations"] as const) {
    const rel = path.posix.join(paperRel, container);
    const abs = path.join(modelRoot, rel);
    if (existsSync(abs)) continue;
    await mkdir(abs, { recursive: true });
    const title =
      container === "figures" ? "Figures" : container === "tables" ? "Tables" : "Equations";
    await writeFile(path.join(abs, "INDEX.md"), indexSkeleton(container, "section"), "utf8");
    await writeFile(
      path.join(abs, "outline.md"),
      outlineDocSkeleton(title, "section"),
      "utf8",
    );
  }
}

export async function listPaperReferences(
  modelRoot: string,
  paperRel: string,
): Promise<ReferenceMetadata[]> {
  const literatureDir = paperLiteratureDir(paperRel);
  const abs = path.join(modelRoot, literatureDir);
  if (!existsSync(abs)) return [];

  const references: ReferenceMetadata[] = [];
  for (const file of await readdir(abs)) {
    if (!file.endsWith(".md") || file === "INDEX.md" || file === "outline.md" || file === "draft.md") {
      continue;
    }
    const noteRel = path.posix.join(literatureDir, file);
    const raw = await readFile(path.join(modelRoot, noteRel), "utf8");
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    if (data.type !== "literature" && !data.cite_key) continue;
    references.push({
      path: noteRel,
      title: String(data.title ?? path.posix.basename(file, ".md")),
      citeKey: data.cite_key ? String(data.cite_key) : null,
      authors: data.authors ? String(data.authors) : null,
      year: data.year ? String(data.year) : null,
      journal: data.journal ? String(data.journal) : null,
    });
  }

  return references.sort((a, b) => {
    const keyA = a.citeKey ?? a.title;
    const keyB = b.citeKey ?? b.title;
    return keyA.localeCompare(keyB);
  });
}

export async function listPaperAssets(
  modelRoot: string,
  paperRel: string,
): Promise<PaperAssetsBundle> {
  await ensurePaperAssetContainers(modelRoot, paperRel);
  const [figures, tables, equations, referenceCount] = await Promise.all([
    listPaperFigures(modelRoot, paperRel),
    listPaperTables(modelRoot, paperRel),
    listPaperEquations(modelRoot, paperRel),
    countPaperReferences(modelRoot, paperRel),
  ]);
  return { figures, tables, equations, referenceCount };
}
