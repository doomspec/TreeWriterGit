import { describe, expect, it } from "vitest";

import {
  assetSearchMatches,
  filterPaperAssets,
  filteredAssetCount,
  totalAssetCount,
} from "./assetSearch";
import type { PaperAssetsBundle, ReferenceMetadata } from "./paperAssets";

const sampleReferences: ReferenceMetadata[] = [
  {
    path: "papers/demo/notes/literature/smith2024.md",
    title: "Deep learning review",
    citeKey: "smith2024",
    authors: "Smith, J.",
    year: "2024",
    journal: "Nature",
  },
];

const sampleAssets: PaperAssetsBundle = {
  figures: [
    {
      kind: "figure-unit",
      path: "papers/demo/figures/hemocytometer",
      title: "Hemocytometer grid",
      caption: "Microscope view",
      summary: null,
      previewPath: null,
      sourcePath: null,
      outlinePath: null,
      draftPath: null,
      figureLabel: "Fig. 1",
    },
  ],
  tables: [
    {
      kind: "table-unit",
      path: "papers/demo/tables/counts",
      title: "Cell counts",
      caption: "",
      summary: null,
      outlinePath: null,
      draftPath: null,
      tableLabel: "Table 1",
    },
  ],
  equations: [],
  referenceCount: 1,
};

describe("assetSearch", () => {
  it("matches assets by title, label, cite key, or path slug", () => {
    expect(assetSearchMatches("hem", "Hemocytometer grid", "Fig. 1")).toBe(true);
    expect(assetSearchMatches("smith", "Deep learning review", "smith2024")).toBe(true);
    expect(assetSearchMatches("counts", "Cell counts")).toBe(true);
    expect(assetSearchMatches("missing", "Cell counts")).toBe(false);
    expect(assetSearchMatches("", "Cell counts")).toBe(true);
  });

  it("filters all asset groups together", () => {
    const filtered = filterPaperAssets(sampleAssets, "cell", sampleReferences);
    expect(filtered.tables).toHaveLength(1);
    expect(filtered.figures).toHaveLength(0);
    expect(filteredAssetCount(filtered)).toBe(1);
    expect(totalAssetCount(sampleAssets)).toBe(3);
  });
});
