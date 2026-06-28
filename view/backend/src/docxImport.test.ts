import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";

import { importMarkdownIntoPaper } from "./docxImport.js";
import { createNode } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-docx-import-"));
  await mkdir(path.join(modelRoot, "papers", "demo"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers", "demo", "INDEX.md"),
    matter.stringify("", { kind: "paper", title: "Demo", section_order: [] }),
    "utf8",
  );
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("importMarkdownIntoPaper", () => {
  it("creates sections, units, and approved drafts from markdown", async () => {
    const markdown = `# Imported Title

## Introduction

First paragraph.

Second paragraph.

## Methods

We ran experiments.
`;

    const result = await importMarkdownIntoPaper(modelRoot, "demo", markdown, {
      approvedBy: "tester",
    });

    expect(result.sectionsCreated).toBe(2);
    expect(result.unitsCreated).toBe(3);
    expect(result.paperTitle).toBe("Imported Title");

    const introDraft = await readFile(
      path.join(modelRoot, "papers/demo/introduction/first-paragraph/draft.md"),
      "utf8",
    );
    expect(introDraft).toContain("First paragraph");

    const paperIndex = matter(
      await readFile(path.join(modelRoot, "papers/demo/INDEX.md"), "utf8"),
    );
    expect(paperIndex.data.title).toBe("Imported Title");
    expect(paperIndex.data.section_order).toEqual(["introduction", "methods"]);
  });

  it("appends to an existing paper section order", async () => {
    await createNode(modelRoot, "papers/demo", "existing", "section");
    await writeFile(
      path.join(modelRoot, "papers/demo/INDEX.md"),
      matter.stringify("", {
        kind: "paper",
        title: "Demo",
        section_order: ["existing"],
      }),
      "utf8",
    );

    await importMarkdownIntoPaper(
      modelRoot,
      "demo",
      "## New Section\n\nImported paragraph.\n",
      { replaceTarget: false },
    );

    const paperIndex = matter(
      await readFile(path.join(modelRoot, "papers/demo/INDEX.md"), "utf8"),
    );
    expect(paperIndex.data.section_order).toEqual(["existing", "new-section"]);
  });

  it("imports into an existing section as subsections", async () => {
    await createNode(modelRoot, "papers/demo", "body", "section");
    await writeFile(
      path.join(modelRoot, "papers/demo/INDEX.md"),
      matter.stringify("", {
        kind: "paper",
        title: "Demo",
        section_order: ["body"],
      }),
      "utf8",
    );

    const result = await importMarkdownIntoPaper(
      modelRoot,
      "demo",
      `**1. Introduction**

First paragraph.

**2. Methods**

We ran experiments.
`,
      { targetSection: "body", replaceTarget: true },
    );

    expect(result.sectionsCreated).toBe(2);
    expect(result.unitsCreated).toBe(2);

    const introDraft = await readFile(
      path.join(modelRoot, "papers/demo/body/1-introduction/first-paragraph/draft.md"),
      "utf8",
    );
    expect(introDraft).toContain("First paragraph");

    const bodyIndex = matter(
      await readFile(path.join(modelRoot, "papers/demo/body/INDEX.md"), "utf8"),
    );
    expect(bodyIndex.data.child_order).toEqual(["1-introduction", "2-methods"]);
  });

  it("imports from a user-edited preview plan", async () => {
    const result = await importMarkdownIntoPaper(
      modelRoot,
      "demo",
      "## Ignored by plan\n\nParagraph.\n",
      {
        replaceTarget: true,
        importPlan: [
          {
            title: "Custom Section",
            slug: "custom-section",
            kind: "section",
            children: [
              {
                title: "First unit",
                slug: "first-unit",
                kind: "unit",
                body: "Planned paragraph one.",
              },
              {
                title: "Second unit",
                slug: "second-unit",
                kind: "unit",
                body: "Planned paragraph two.",
              },
            ],
          },
        ],
      },
    );

    expect(result.sectionsCreated).toBe(1);
    expect(result.unitsCreated).toBe(2);

    const draft = await readFile(
      path.join(modelRoot, "papers/demo/custom-section/first-unit/draft.md"),
      "utf8",
    );
    expect(draft).toContain("Planned paragraph one.");
  });
});
