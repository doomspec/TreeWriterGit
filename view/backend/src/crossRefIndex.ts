import path from "node:path";

import { figureLabel } from "./exportEmbeds.js";
import type { FigureMetadata } from "./figures.js";
import type { TableMetadata } from "./tables.js";

export type CrossRefIndex = {
  figureLabels: Record<string, FigureMetadata>;
  tableLabels: Record<string, TableMetadata>;
};

function tableLabel(meta: { tableLabel: string | null; path: string }): string | null {
  if (meta.tableLabel?.trim()) return meta.tableLabel.trim();
  const base = path.posix.basename(meta.path);
  if (base) return `tab:${base}`;
  return null;
}

function registerFigureAliases(
  index: Map<string, FigureMetadata>,
  meta: FigureMetadata,
): void {
  const primary = figureLabel(meta);
  if (primary) index.set(primary, meta);

  const folder = path.posix.basename(meta.path);
  if (folder) {
    const folderKey = `fig:${folder}`;
    if (!index.has(folderKey)) index.set(folderKey, meta);
  }
}

function registerTableAliases(index: Map<string, TableMetadata>, meta: TableMetadata): void {
  const primary = tableLabel(meta);
  if (primary) index.set(primary, meta);

  const folder = path.posix.basename(meta.path);
  if (folder) {
    const folderKey = `tab:${folder}`;
    if (!index.has(folderKey)) index.set(folderKey, meta);
  }
}

/** Map LaTeX figure ref keys to figure metadata (figure_label + fig:{folder} aliases). */
export function buildFigureLabelIndex(figures: FigureMetadata[]): Map<string, FigureMetadata> {
  const index = new Map<string, FigureMetadata>();
  for (const meta of figures) {
    registerFigureAliases(index, meta);
  }
  return index;
}

/** Map LaTeX table ref keys to table metadata (table_label + tab:{folder} aliases). */
export function buildTableLabelIndex(tables: TableMetadata[]): Map<string, TableMetadata> {
  const index = new Map<string, TableMetadata>();
  for (const meta of tables) {
    registerTableAliases(index, meta);
  }
  return index;
}

export function resolveFigureByRefKey(
  refKey: string,
  index: Map<string, FigureMetadata>,
): FigureMetadata | null {
  const trimmed = refKey.trim();
  if (!trimmed) return null;
  return index.get(trimmed) ?? null;
}

export function resolveTableByRefKey(
  refKey: string,
  index: Map<string, TableMetadata>,
): TableMetadata | null {
  const trimmed = refKey.trim();
  if (!trimmed) return null;
  return index.get(trimmed) ?? null;
}

export function crossRefIndexFromMaps(
  figureIndex: Map<string, FigureMetadata>,
  tableIndex: Map<string, TableMetadata>,
): CrossRefIndex {
  return {
    figureLabels: Object.fromEntries(figureIndex),
    tableLabels: Object.fromEntries(tableIndex),
  };
}

export async function buildPaperCrossRefIndex(
  modelRoot: string,
  paperRel: string,
): Promise<CrossRefIndex> {
  const { listPaperFigures } = await import("./figures.js");
  const { listPaperTables } = await import("./tables.js");
  const figures = await listPaperFigures(modelRoot, paperRel);
  const tables = await listPaperTables(modelRoot, paperRel);
  return crossRefIndexFromMaps(buildFigureLabelIndex(figures), buildTableLabelIndex(tables));
}
