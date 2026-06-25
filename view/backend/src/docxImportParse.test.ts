import { describe, expect, it } from "vitest";

import {
  parseMarkdownImportStructure,
  slugFromImportTitle,
  uniqueImportSlug,
} from "./docxImportParse.js";

describe("parseMarkdownImportStructure", () => {
  it("maps H2 sections and paragraph units", () => {
    const parsed = parseMarkdownImportStructure(`# Demo Paper

## Introduction

First claim with evidence.

Second paragraph in intro.

## Methods

We ran experiments.
`);
    expect(parsed.paperTitle).toBe("Demo Paper");
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].title).toBe("Introduction");
    expect(parsed.sections[0].units).toHaveLength(2);
    expect(parsed.sections[1].units[0].body).toContain("experiments");
  });

  it("maps H3 blocks to titled units", () => {
    const parsed = parseMarkdownImportStructure(`## Results

### Primary outcome

Patients improved significantly.

### Secondary outcome

No adverse events.
`);
    expect(parsed.sections[0].units).toHaveLength(2);
    expect(parsed.sections[0].units[0].title).toBe("Primary outcome");
    expect(parsed.sections[0].units[1].body).toContain("adverse events");
  });
});

describe("slugFromImportTitle", () => {
  it("normalizes titles into node slugs", () => {
    expect(slugFromImportTitle("Primary Outcome")).toBe("primary-outcome");
    expect(slugFromImportTitle("")).toBe("item");
  });

  it("dedupes slugs within a parent", () => {
    const used = new Set<string>();
    expect(uniqueImportSlug("Results", used)).toBe("results");
    expect(uniqueImportSlug("Results", used)).toBe("results-2");
  });
});
