import { describe, expect, it } from "vitest";

import {
  parseMarkdownImportStructure,
  slugFromImportTitle,
  uniqueImportSlug,
} from "../import/parse.js";

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

  it("maps H3 blocks to subsections with paragraph units", () => {
    const parsed = parseMarkdownImportStructure(`## Results

### Primary outcome

Patients improved significantly.

### Secondary outcome

No adverse events.
`);
    expect(parsed.sections[0].units).toHaveLength(0);
    expect(parsed.sections[0].subsections).toHaveLength(2);
    expect(parsed.sections[0].subsections[0].title).toBe("Primary outcome");
    expect(parsed.sections[0].subsections[0].units[0].body).toContain("improved");
    expect(parsed.sections[0].subsections[1].units[0].body).toContain("adverse events");
  });

  it("splits multiple paragraphs under one H3 into separate units in a subsection", () => {
    const parsed = parseMarkdownImportStructure(`## Methods

### Extrusion bioprinting

First paragraph about extrusion.

Second paragraph about extrusion.

Third paragraph about extrusion.
`);
    expect(parsed.sections[0].units).toHaveLength(0);
    expect(parsed.sections[0].subsections).toHaveLength(1);
    expect(parsed.sections[0].subsections[0].title).toBe("Extrusion bioprinting");
    expect(parsed.sections[0].subsections[0].units).toHaveLength(3);
    expect(parsed.sections[0].subsections[0].units[0].body).toContain("First paragraph");
    expect(parsed.sections[0].subsections[0].units[1].body).toContain("Second paragraph");
    expect(parsed.sections[0].subsections[0].units[2].body).toContain("Third paragraph");
  });

  it("maps bold Word headings to sections and units", () => {
    const parsed = parseMarkdownImportStructure(`**1. Introduction**

First paragraph.

**2. Key Categories**

**2.1. Biofabrication Platforms**

Electrospinning paragraph.

Another paragraph in the same subsection.
`);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].title).toBe("1. Introduction");
    expect(parsed.sections[0].units).toHaveLength(1);
    expect(parsed.sections[1].title).toBe("2. Key Categories");
    expect(parsed.sections[1].units).toHaveLength(0);
    expect(parsed.sections[1].subsections).toHaveLength(1);
    expect(parsed.sections[1].subsections[0].title).toBe("2.1. Biofabrication Platforms");
    expect(parsed.sections[1].subsections[0].units).toHaveLength(2);
    expect(parsed.sections[1].subsections[0].units[0].body).toContain("Electrospinning");
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
