import { describe, expect, it } from "vitest";

import {
  defaultFigureInsertMode,
  figureInsertSnippet,
  paperPathFromModelPath,
  appendCiteTriggerKey,
  appendOpenCitationKey,
  applyReferenceInsertion,
  finalizeCiteTrigger,
  parseCiteTriggerKeys,
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
    expect(referenceInsertSnippet(["smith2024", "jones2020"])).toBe("[@smith2024; @jones2020]");
  });

  it("groups multiple cite keys for pandoc export", () => {
    const result = applyReferenceInsertion("See ", 4, ["smith2024", "jones2020"]);
    expect(result.value).toBe("See [@smith2024; @jones2020]");
  });

  it("extends \\cite{a, b} triggers with additional keys", () => {
    const text = "See \\cite{smith2024, ";
    const result = applyReferenceInsertion(text, text.length, ["jones2020"], {
      start: 4,
      end: text.length,
      query: "smith2024, ",
      mode: "command",
    });
    expect(result.value).toBe("See [@smith2024; @jones2020]");
  });

  it("appends cite keys and keeps the trigger open", () => {
    const text = "See \\cite{smith";
    const result = appendCiteTriggerKey(
      text,
      { start: 4, end: text.length, query: "smith" },
      "smith2024",
    );
    expect(result.value).toBe("See \\cite{smith2024, ");
    expect(result.cursor).toBe(result.value.length);
  });

  it("finalizes comma-separated cite triggers", () => {
    const text = "See \\cite{smith2024, jones2020, ";
    const result = finalizeCiteTrigger(text, {
      start: 4,
      end: text.length,
      query: "smith2024, jones2020, ",
      mode: "command",
    });
    expect(result.value).toBe("See [@smith2024; @jones2020]");
  });

  it("filters cite search after semicolon in \\cite{}", () => {
    const parsed = parseCiteTriggerKeys("smith2024; jones");
    expect(parsed.committed).toEqual(["smith2024"]);
    expect(parsed.filter).toBe("jones");
  });

  it("appends open cite keys and keeps the trigger open", () => {
    const text = "See [@smith";
    const result = appendOpenCitationKey(text, 4, text.length, "smith", "smith2024");
    expect(result.value).toBe("See [@smith2024; ");
    expect(result.cursor).toBe(result.value.length);
  });
});
