import { describe, expect, it } from "vitest";

import {
  buildBlockHeadingIdMap,
  extractMarkdownHeadings,
} from "@/lib/markdownOutline";
import { splitMarkdownIntoBlocks } from "@/lib/markdownBlocks";

describe("extractMarkdownHeadings", () => {
  it("extracts ATX headings with stable ids", () => {
    const md = `# Intro\n\n## Methods\n\n### Data`;
    expect(extractMarkdownHeadings(md)).toEqual([
      { id: "heading-intro", level: 1, text: "Intro", lineIndex: 0 },
      { id: "heading-methods", level: 2, text: "Methods", lineIndex: 2 },
      { id: "heading-data", level: 3, text: "Data", lineIndex: 4 },
    ]);
  });

  it("parses linked section headings", () => {
    const md = `## [Results](papers/demo/results)\n\nBody.`;
    expect(extractMarkdownHeadings(md)).toEqual([
      {
        id: "heading-results",
        level: 2,
        text: "Results",
        lineIndex: 0,
      },
    ]);
  });

  it("skips headings inside fenced code", () => {
    const md = "```\n# not a heading\n```\n\n# Real";
    expect(extractMarkdownHeadings(md)).toEqual([
      { id: "heading-real", level: 1, text: "Real", lineIndex: 4 },
    ]);
  });

  it("deduplicates slug collisions", () => {
    const md = `# Intro\n\n## Intro\n\n### Intro`;
    const ids = extractMarkdownHeadings(md).map((h) => h.id);
    expect(ids).toEqual(["heading-intro", "heading-intro-2", "heading-intro-3"]);
  });
});

describe("buildBlockHeadingIdMap", () => {
  it("maps block ids to heading ids in order", () => {
    const blocks = splitMarkdownIntoBlocks(`# Title\n\nParagraph.\n\n## Section`);
    const map = buildBlockHeadingIdMap(blocks);
    const ids = blocks.map((b) => map[b.id]).filter(Boolean);
    expect(ids).toEqual(["heading-title", "heading-section"]);
  });
});
