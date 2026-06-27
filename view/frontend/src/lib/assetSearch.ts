import type { FigureMetadata } from "@/lib/figures";
import type {
  EquationMetadata,
  PaperAssetsBundle,
  ReferenceMetadata,
  TableMetadata,
} from "@/lib/paperAssets";

export function normalizeAssetSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function pathSlug(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/, "") ?? path;
}

/** Whether an asset matches a free-text search query. Empty query matches all. */
export function assetSearchMatches(query: string, ...parts: (string | null | undefined)[]): boolean {
  const normalized = normalizeAssetSearchQuery(query);
  if (!normalized) return true;

  const haystacks = parts.map((part) => normalizeAssetSearchQuery(part ?? "")).filter(Boolean);
  if (haystacks.length === 0) return false;
  if (haystacks.some((part) => part.includes(normalized))) return true;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystacks.some((part) => part.includes(token)));
}

/** Rank assets for autocomplete — higher is a better match. */
export function scoreAssetMatch(query: string, ...parts: (string | null | undefined)[]): number {
  const normalized = normalizeAssetSearchQuery(query);
  if (!normalized) return 0;

  const haystacks = parts.map((part) => normalizeAssetSearchQuery(part ?? "")).filter(Boolean);
  if (haystacks.length === 0) return -1;
  if (haystacks.some((part) => part.startsWith(normalized))) return 3;
  if (haystacks.some((part) => part.includes(normalized))) return 2;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => haystacks.some((part) => part.includes(token)))) {
    return 1;
  }
  return -1;
}

export function filterFigures(figures: FigureMetadata[], query: string): FigureMetadata[] {
  return figures.filter((figure) =>
    assetSearchMatches(
      query,
      figure.title,
      figure.figureLabel,
      figure.caption,
      figure.summary,
      pathSlug(figure.path),
    ),
  );
}

export function filterTables(tables: TableMetadata[], query: string): TableMetadata[] {
  return tables.filter((table) =>
    assetSearchMatches(
      query,
      table.title,
      table.tableLabel,
      table.caption,
      table.summary,
      pathSlug(table.path),
    ),
  );
}

export function filterEquations(equations: EquationMetadata[], query: string): EquationMetadata[] {
  return equations.filter((equation) =>
    assetSearchMatches(
      query,
      equation.title,
      equation.equationLabel,
      equation.caption,
      equation.summary,
      pathSlug(equation.path),
    ),
  );
}

export function filterReferences(references: ReferenceMetadata[], query: string): ReferenceMetadata[] {
  return references.filter((reference) =>
    assetSearchMatches(
      query,
      reference.title,
      reference.citeKey,
      reference.authors,
      reference.year,
      reference.journal,
      pathSlug(reference.path),
    ),
  );
}

export function filterPaperAssets(
  assets: PaperAssetsBundle,
  query: string,
  references: ReferenceMetadata[] = [],
): PaperAssetsBundle & { references: ReferenceMetadata[] } {
  return {
    figures: filterFigures(assets.figures, query),
    tables: filterTables(assets.tables, query),
    equations: filterEquations(assets.equations, query),
    referenceCount: assets.referenceCount,
    references: filterReferences(references, query),
  };
}

export function totalAssetCount(assets: PaperAssetsBundle, referenceCount?: number): number {
  return (
    assets.figures.length +
    assets.tables.length +
    assets.equations.length +
    (referenceCount ?? assets.referenceCount)
  );
}

export function filteredAssetCount(
  assets: PaperAssetsBundle & { references?: ReferenceMetadata[] },
): number {
  return (
    assets.figures.length +
    assets.tables.length +
    assets.equations.length +
    (assets.references?.length ?? 0)
  );
}
