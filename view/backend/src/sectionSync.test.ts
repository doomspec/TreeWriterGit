import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import matter from "gray-matter";

import {
  parseLinkedHeadingBlocks,
  parseOutlineListItems,
  resolveChildHref,
  extractPreambleBeforeLinkedHeadings,
  syncSectionDraftToChildren,
  syncSectionOutlineToChildren,
} from "./sectionSync.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-section-sync-"));
  await mkdir(path.join(modelRoot, "papers/demo/introduction/background"), { recursive: true });
  await mkdir(path.join(modelRoot, "papers/demo/introduction/contributions"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers/demo/introduction/INDEX.md"),
    matter.stringify("\n", {
      kind: "section",
      title: "Introduction",
      child_order: ["background", "contributions"],
    }),
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, "papers/demo/introduction/background/INDEX.md"),
    matter.stringify("\n", { kind: "unit", title: "Background", status: "outline", links: [] }),
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, "papers/demo/introduction/contributions/INDEX.md"),
    matter.stringify("\n", { kind: "unit", title: "Contributions", status: "outline", links: [] }),
    "utf8",
  );
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("resolveChildHref", () => {
  it("resolves INDEX.md links relative to the section", () => {
    expect(resolveChildHref("papers/demo/introduction", "background/INDEX.md")).toBe(
      "papers/demo/introduction/background",
    );
  });
});

describe("parseOutlineListItems", () => {
  it("parses outline bullets with optional notes", () => {
    const items = parseOutlineListItems(`# Intro

## Summary

Overview

## Outline

* [Background](background/INDEX.md) — prior work context
* [Contributions](contributions/INDEX.md)
`);
    expect(items).toHaveLength(2);
    expect(items[0].note).toBe("prior work context");
  });
});

describe("parseLinkedHeadingBlocks", () => {
  it("parses linked heading blocks from composed drafts", () => {
    const blocks = parseLinkedHeadingBlocks(`# Introduction

## [Background](background/INDEX.md)

Prior art paragraph.

## [Contributions](contributions/INDEX.md)

Our claims.
`);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].body).toContain("Prior art");
  });
});

describe("syncSectionOutlineToChildren", () => {
  it("updates child outline summaries from outline list notes", async () => {
    const updated = await syncSectionOutlineToChildren(
      modelRoot,
      "papers/demo/introduction",
      `# Introduction

## Summary

Section overview

## Outline

* [Background](background/INDEX.md) — updated background summary
`,
    );
    expect(updated.some((p) => p.endsWith("background/outline.md"))).toBe(true);
    const childOutline = await readFile(
      path.join(modelRoot, "papers/demo/introduction/background/outline.md"),
      "utf8",
    );
    expect(childOutline).toContain("updated background summary");
  });
});

describe("extractPreambleBeforeLinkedHeadings", () => {
  it("splits summary text from linked section headings", () => {
    const { preamble, remainder } = extractPreambleBeforeLinkedHeadings(`# Paper

Paper summary here.

## [Introduction](introduction/INDEX.md)

Intro body.
`);
    expect(preamble).toBe("Paper summary here.");
    expect(remainder).toContain("## [Introduction]");
  });
});

describe("syncSectionDraftToChildren", () => {
  it("writes child drafts from composed section draft blocks", async () => {
    const updated = await syncSectionDraftToChildren(
      modelRoot,
      "papers/demo/introduction",
      `# Introduction

## [Background](background/INDEX.md)

Background draft text.

## [Contributions](contributions/INDEX.md)

Contribution draft text.
`,
    );
    expect(updated).toHaveLength(2);
    const backgroundDraft = await readFile(
      path.join(modelRoot, "papers/demo/introduction/background/draft.md"),
      "utf8",
    );
    expect(backgroundDraft.trim()).toBe("Background draft text.");
  });

  it("recursively syncs nested subsection units", async () => {
    await mkdir(path.join(modelRoot, "papers/demo/introduction/methods/setup"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/methods/INDEX.md"),
      matter.stringify("\n", { kind: "section", title: "Methods", child_order: ["setup"] }),
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/methods/setup/INDEX.md"),
      matter.stringify("\n", { kind: "unit", title: "Setup", status: "outline", links: [] }),
      "utf8",
    );

    const updated = await syncSectionDraftToChildren(
      modelRoot,
      "papers/demo/introduction",
      `# Introduction

## [Methods](methods/INDEX.md)

### [Setup](methods/setup/INDEX.md)

Setup prose here.
`,
    );
    expect(updated.some((p) => p.endsWith("methods/setup/draft.md"))).toBe(true);
    const setupDraft = await readFile(
      path.join(modelRoot, "papers/demo/introduction/methods/setup/draft.md"),
      "utf8",
    );
    expect(setupDraft.trim()).toBe("Setup prose here.");
  });
});
