import {
  buildFigureLabelIndex,
  buildTableLabelIndex,
  type CrossRefIndex,
} from "./crossRefIndex.js";
import { listPaperFigures } from "./figures.js";
import { listPaperTables } from "./tables.js";

const REF_PATTERN = /\\ref\{([^}]+)\}/g;

/** Unique \\ref{…} keys in document order. */
export function extractCrossRefKeys(markdown: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(REF_PATTERN)) {
    const key = match[1]?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function findOrphanCrossRefs(
  markdown: string,
  figureIndex: Map<string, import("./figures.js").FigureMetadata>,
  tableIndex: Map<string, import("./tables.js").TableMetadata>,
): string[] {
  const orphans: string[] = [];
  for (const key of extractCrossRefKeys(markdown)) {
    if (key.startsWith("fig:") && !figureIndex.has(key)) {
      orphans.push(key);
    } else if (key.startsWith("tab:") && !tableIndex.has(key)) {
      orphans.push(key);
    }
  }
  return orphans;
}

export async function validatePaperCrossRefs(
  modelRoot: string,
  paperRel: string,
  markdown: string,
): Promise<{ orphanCrossRefs: string[]; index: CrossRefIndex }> {
  const figures = await listPaperFigures(modelRoot, paperRel);
  const tables = await listPaperTables(modelRoot, paperRel);
  const figureIndex = buildFigureLabelIndex(figures);
  const tableIndex = buildTableLabelIndex(tables);
  const orphanCrossRefs = findOrphanCrossRefs(markdown, figureIndex, tableIndex);
  return {
    orphanCrossRefs,
    index: {
      figureLabels: Object.fromEntries(figureIndex),
      tableLabels: Object.fromEntries(tableIndex),
    },
  };
}
