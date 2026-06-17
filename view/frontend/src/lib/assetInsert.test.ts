import { describe, expect, it } from "vitest";

import {
  defaultFigureInsertMode,
  figureInsertSnippet,
  paperPathFromModelPath,
  referenceInsertSnippet,
  tableInsertSnippet,
} from "./assetInsert";

describe("assetInsert", () => {
  it("derives paper path from model paths", () => {
    expect(paperPathFromModelPath("papers/roboculture/results/draft.md")).toBe("papers/roboculture");
    expect(paperPathFromModelPath("notes/foo.md")).toBeNull();
  });

  it("embeds figures in draft and links elsewhere", () => {
    expect(defaultFigureInsertMode("papers/a/units/x/draft.md")).toBe("embed");
    expect(defaultFigureInsertMode("papers/a/units/x/outline.md")).toBe("link");
    expect(figureInsertSnippet("papers/a/figures/fig1", "Fig 1", "embed")).toContain(
      "::figure[papers/a/figures/fig1]",
    );
    expect(figureInsertSnippet("papers/a/figures/fig1", "Fig 1", "link")).toBe(
      "[[papers/a/figures/fig1|Fig 1]]",
    );
  });

  it("builds table and reference snippets", () => {
    expect(tableInsertSnippet("papers/a/tables/t1", "Table 1")).toBe("[[papers/a/tables/t1|Table 1]]");
    expect(referenceInsertSnippet("smith2024")).toBe("[@smith2024]");
  });
});
