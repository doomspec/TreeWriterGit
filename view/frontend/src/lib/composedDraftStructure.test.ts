import { describe, expect, it, vi } from "vitest";

import {
  analyzeComposedDraftUnits,
  buildLinkedHeadingMarkdown,
  childFolderSlugsFromComposedBody,
  combineMultiParagraphUnits,
  findMultiParagraphUnits,
  insertMarkdownAfterBlock,
  splitMultiParagraphUnits,
} from "@/lib/composedDraftStructure";

describe("analyzeComposedDraftUnits", () => {
  it("groups linked headings with following paragraph blocks", () => {
    const body = `## [Problem](problem/INDEX.md)

First paragraph.

Second paragraph.

## [Methods](methods/INDEX.md)

Methods text.`;

    const units = analyzeComposedDraftUnits(body);
    expect(units).toHaveLength(2);
    expect(units[0].paragraphs).toEqual(["First paragraph.", "Second paragraph."]);
    expect(units[1].paragraphs).toEqual(["Methods text."]);
  });
});

describe("findMultiParagraphUnits", () => {
  it("flags units with more than one paragraph", () => {
    const body = `## [Problem](problem/INDEX.md)

One.

Two.`;
    expect(findMultiParagraphUnits(body)).toHaveLength(1);
  });
});

describe("insertMarkdownAfterBlock", () => {
  it("inserts new blocks after the selected index", () => {
    const body = "Alpha.\n\nBeta.";
    const next = insertMarkdownAfterBlock(body, 0, [
      buildLinkedHeadingMarkdown("gamma"),
      "Gamma text.",
    ]);
    expect(next).toContain("Alpha.");
    expect(next).toContain("## [Gamma](gamma/INDEX.md)");
    expect(next).toContain("Gamma text.");
    expect(next).toContain("Beta.");
  });
});

describe("combineMultiParagraphUnits", () => {
  it("merges paragraphs within each unit", () => {
    const body = `## [Problem](problem/INDEX.md)

One.

Two.`;
    expect(combineMultiParagraphUnits(body)).toBe(
      "## [Problem](problem/INDEX.md)\n\nOne. Two.",
    );
  });
});

describe("splitMultiParagraphUnits", () => {
  it("creates new units for extra paragraphs", async () => {
    const created: string[] = [];
    const body = `## [Problem](problem/INDEX.md)

First point.

Second point.`;

    const next = await splitMultiParagraphUnits(body, async (slug) => {
      created.push(slug);
    });

    expect(created).toHaveLength(1);
    expect(next).toContain("First point.");
    expect(next).toContain("Second point.");
    expect(next.match(/## \[/g)?.length).toBe(2);
  });
});

describe("childFolderSlugsFromComposedBody", () => {
  it("returns linked folder slugs in document order", () => {
    const body = `## [Problem](problem/INDEX.md)

Text.

## [Methods](methods/INDEX.md)

More.`;
    expect(childFolderSlugsFromComposedBody(body)).toEqual(["problem", "methods"]);
  });
});
