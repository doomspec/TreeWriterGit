import { describe, expect, it } from "vitest";

import {
  buildBlockHeadingIdMap,
  extractMarkdownHeadings,
  filterDocumentOutlineHeadings,
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
        href: "papers/demo/results",
      },
    ]);
  });

  it("extracts outline list links under ## Outline", () => {
    const md = `# Introduction

## Summary

Intro summary.

## Outline
- [Background](background/INDEX.md)
- [Solution](solution/INDEX.md)

## Notes

Other.`;

    const headings = extractMarkdownHeadings(md);
    expect(headings.map((h) => h.text)).toEqual([
      "Introduction",
      "Summary",
      "Outline",
      "Background",
      "Solution",
      "Notes",
    ]);
    expect(headings.find((h) => h.text === "Background")).toMatchObject({
      level: 3,
      href: "background/INDEX.md",
    });
  });

  it("extracts list links under ## Sections", () => {
    const md = `# Paper

## Sections
- [Introduction](introduction/INDEX.md)
- [Results](results/INDEX.md)`;

    const headings = extractMarkdownHeadings(md);
    expect(headings.map((h) => h.text)).toEqual([
      "Paper",
      "Sections",
      "Introduction",
      "Results",
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

describe("filterDocumentOutlineHeadings", () => {
  it("keeps title and outline list links, dropping meta headings", () => {
    const md = `# Introduction

## Summary

Intro summary.

## Outline
- [Background](background/INDEX.md)
- [Solution](solution/INDEX.md)

## Notes

Other.`;

    expect(filterDocumentOutlineHeadings(extractMarkdownHeadings(md)).map((h) => h.text)).toEqual([
      "Introduction",
      "Background",
      "Solution",
    ]);
  });

  it("keeps composed-draft sections and subsections", () => {
    const md = `# Paper

## Introduction

Body.

### Background

More.

#### Deep detail

## Methods`;

    expect(filterDocumentOutlineHeadings(extractMarkdownHeadings(md)).map((h) => h.text)).toEqual([
      "Paper",
      "Introduction",
      "Background",
      "Methods",
    ]);
  });

  it("keeps only the title when no outline links or section headings remain", () => {
    const md = `# VibeCount

## Summary

Planning notes only.`;
    expect(filterDocumentOutlineHeadings(extractMarkdownHeadings(md)).map((h) => h.text)).toEqual([
      "VibeCount",
    ]);
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
