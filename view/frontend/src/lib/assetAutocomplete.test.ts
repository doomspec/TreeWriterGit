import { describe, expect, it } from "vitest";

import {
  applyAssetCompletion,
  appendReferenceCompletion,
  buildAssetCompletions,
  detectAssetTrigger,
  finishReferenceCompletion,
  pendingCiteKeysFromTrigger,
  shouldKeepAutocompleteOpen,
  shouldResetAutocompleteSelection,
} from "./assetAutocomplete";
import type { PaperAssetsBundle } from "./paperAssets";

const sampleReferences = [
  {
    path: "papers/demo/notes/literature/smith2024.md",
    title: "Smith et al.",
    citeKey: "smith2024",
    authors: "Smith, J.",
    year: "2024",
    journal: "Nature",
  },
  {
    path: "papers/demo/notes/literature/jones2020.md",
    title: "Jones review",
    citeKey: "jones2020",
    authors: "Jones, A.",
    year: "2020",
    journal: "Science",
  },
] as const;

const sampleAssets: PaperAssetsBundle = {
  figures: [
    {
      kind: "figure-unit",
      path: "papers/demo/figures/hemocytometer",
      title: "Hemocytometer grid",
      caption: "",
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
  equations: [
    {
      kind: "equation-unit",
      path: "papers/demo/equations/density",
      title: "Cell density",
      caption: "",
      summary: null,
      sourcePath: null,
      outlinePath: null,
      draftPath: null,
      equationLabel: "Eq. 1",
    },
  ],
  referenceCount: 2,
};

describe("assetAutocomplete", () => {
  it("detects Overleaf-style triggers before the cursor", () => {
    expect(detectAssetTrigger("See \\fig{hem", 12)).toMatchObject({
      kind: "fig",
      query: "hem",
      start: 4,
    });
    expect(detectAssetTrigger("See \\figure{", 12)).toMatchObject({ kind: "fig", query: "" });
    expect(detectAssetTrigger("\\table{count", 13)).toMatchObject({ kind: "table", query: "count" });
    expect(detectAssetTrigger("\\cite{smith", 12)).toMatchObject({ kind: "cite", query: "smith" });
    expect(detectAssetTrigger("\\ref{smith", 11)).toMatchObject({ kind: "cite", query: "smith" });
    expect(detectAssetTrigger("\\eq{density", 12)).toMatchObject({ kind: "eq", query: "density" });
    expect(detectAssetTrigger("plain text", 10)).toBeNull();
    expect(detectAssetTrigger("\\fig{done}", 11)).toBeNull();
  });

  it("filters assets by query and builds snippets", () => {
    const trigger = detectAssetTrigger("\\fig{hem", 8)!;
    const items = buildAssetCompletions(
      sampleAssets,
      trigger,
      "papers/demo/units/x/draft.md",
      [...sampleReferences],
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.snippet).toContain("::figure[papers/demo/figures/hemocytometer]");
  });

  it("applies a completion by replacing the trigger span", () => {
    const text = "As shown in \\fig{hem";
    const trigger = detectAssetTrigger(text, text.length)!;
    const item = buildAssetCompletions(
      sampleAssets,
      trigger,
      "papers/demo/units/x/outline.md",
    )[0]!;
    const result = applyAssetCompletion(text, trigger, item);
    expect(result.value).toContain("[[papers/demo/figures/hemocytometer|Hemocytometer grid]]");
    expect(result.cursor).toBe(result.value.length);
  });

  it("groups multiple cite keys from comma-separated \\cite triggers", () => {
    const text = "See \\cite{smith2024, jones";
    const trigger = detectAssetTrigger(text, text.length)!;
    const item = buildAssetCompletions(
      sampleAssets,
      trigger,
      "papers/demo/units/x/draft.md",
      [...sampleReferences],
    )[0]!;
    const appended = appendReferenceCompletion(text, trigger, item.citeKey!);
    expect(appended.value).toBe("See \\cite{smith2024, jones2020, ");
    const finished = finishReferenceCompletion(appended.value, detectAssetTrigger(appended.value, appended.cursor)!);
    expect(finished.value).toBe("See [@smith2024; @jones2020]");
  });

  it("detects open [@ citations for continued picking", () => {
    const text = "See [@smith2024; jones";
    expect(detectAssetTrigger(text, text.length)).toMatchObject({
      kind: "cite",
      citeMode: "open",
    });
  });

  it("filters cite search using only text after semicolon", () => {
    const trigger = detectAssetTrigger("See \\cite{smith2024; jon", "See \\cite{smith2024; jon".length)!;
    const items = buildAssetCompletions(
      sampleAssets,
      trigger,
      "papers/demo/units/x/draft.md",
      [...sampleReferences],
    );
    expect(items.map((item) => item.citeKey)).toEqual(["jones2020"]);

    const openTrigger = detectAssetTrigger("See [@smith2024; jon", "See [@smith2024; jon".length)!;
    const openItems = buildAssetCompletions(
      sampleAssets,
      openTrigger,
      "papers/demo/units/x/draft.md",
      [...sampleReferences],
    );
    expect(openItems.map((item) => item.citeKey)).toEqual(["jones2020"]);
  });

  it("resets cite selection when a new segment starts after semicolon", () => {
    const prev = detectAssetTrigger("See [@smith2024; jones", "See [@smith2024; jones".length)!;
    const next = detectAssetTrigger("See [@smith2024; ", "See [@smith2024; ".length)!;
    expect(shouldResetAutocompleteSelection(prev, next)).toBe(true);
  });

  it("preserves cite selection while extending the active filter", () => {
    const prev = detectAssetTrigger("See [@smith2024; jo", "See [@smith2024; jo".length)!;
    const next = detectAssetTrigger("See [@smith2024; jon", "See [@smith2024; jon".length)!;
    expect(shouldResetAutocompleteSelection(prev, next)).toBe(false);
  });

  it("appends the first open cite key into the editor text", () => {
    const text = "See [@smith";
    const trigger = detectAssetTrigger(text, text.length)!;
    const item = buildAssetCompletions(
      sampleAssets,
      trigger,
      "papers/demo/units/x/draft.md",
      [...sampleReferences],
    )[0]!;
    const result = appendReferenceCompletion(text, trigger, item.citeKey!);
    expect(result.value).toBe("See [@smith2024; ");
  });

  it("marks committed keys as attached after the first pick", () => {
    const text = "See [@smith2024; ";
    const trigger = detectAssetTrigger(text, text.length)!;
    expect(pendingCiteKeysFromTrigger(trigger)).toEqual(["smith2024"]);
  });

  it("closes autocomplete when the caret leaves the active cite trigger", () => {
    const text = "See [@smith2024; jo";
    const trigger = detectAssetTrigger(text, text.length)!;
    expect(shouldKeepAutocompleteOpen(text, text.length, trigger)).toBe(true);
    expect(shouldKeepAutocompleteOpen(text, 0, trigger)).toBe(false);
    expect(shouldKeepAutocompleteOpen("plain text", 5, trigger)).toBe(false);
  });

  it("keeps autocomplete open while still inside the same asset trigger", () => {
    const text = "See \\cite{smith";
    const trigger = detectAssetTrigger(text, text.length)!;
    expect(shouldKeepAutocompleteOpen(text, text.length, trigger)).toBe(true);
    expect(shouldKeepAutocompleteOpen(text, text.length - 1, trigger)).toBe(true);
  });
});
