import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import {
  buildBibliography,
  buildCombinedMarkdown,
  extractCiteKeys,
  findMissingCitations,
  resolveCslPath,
} from "./export.js";

let root: string;

async function seedPaper(): Promise<void> {
  const paperRel = "papers/demo";
  await mkdir(path.join(root, paperRel, "introduction"), { recursive: true });
  await mkdir(path.join(root, paperRel, "notes", "literature"), { recursive: true });

  await writeFile(
    path.join(root, paperRel, "INDEX.md"),
    matter.stringify("", {
      kind: "paper",
      title: "Demo Paper",
      section_order: ["introduction"],
    }),
    "utf8",
  );

  await writeFile(
    path.join(root, paperRel, "introduction", "INDEX.md"),
    matter.stringify("", {
      kind: "section",
      title: "Introduction",
      child_order: ["claim"],
    }),
    "utf8",
  );

  await mkdir(path.join(root, paperRel, "introduction", "claim"), { recursive: true });
  await writeFile(
    path.join(root, paperRel, "introduction", "claim", "INDEX.md"),
    matter.stringify("", { kind: "unit", title: "Claim", status: "draft" }),
    "utf8",
  );
  await writeFile(
    path.join(root, paperRel, "introduction", "claim", "outline.md"),
    "# Claim\n\n",
    "utf8",
  );
  await writeFile(
    path.join(root, paperRel, "introduction", "claim", "draft.md"),
    "We show that [@smith2024] matters.\n",
    "utf8",
  );

  await writeFile(
    path.join(root, paperRel, "notes", "literature", "smith2024.md"),
    matter.stringify("# Smith 2024\n", {
      cite_key: "smith2024",
      title: "Smith Paper",
      authors: "Smith, J.",
      year: 2024,
      journal: "Nature",
    }),
    "utf8",
  );
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tw-export-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("extractCiteKeys", () => {
  it("parses bracketed pandoc citations", () => {
    expect(extractCiteKeys("See [@a, @b] and [@c]")).toEqual(["a", "b", "c"]);
  });
});

describe("buildCombinedMarkdown", () => {
  it("walks section_order then child_order with includeDrafts", async () => {
    await seedPaper();
    const { markdown, unitCount } = await buildCombinedMarkdown(root, "papers/demo", true);
    expect(unitCount).toBe(1);
    expect(markdown).toContain("# Demo Paper");
    expect(markdown).toContain("## Introduction");
    expect(markdown).toContain("[@smith2024]");
  });

  it("skips non-approved units by default", async () => {
    await seedPaper();
    const { unitCount } = await buildCombinedMarkdown(root, "papers/demo", false);
    expect(unitCount).toBe(0);
  });

  it("includes approved units only when includeDrafts is false", async () => {
    await seedPaper();
    await writeFile(
      path.join(root, "papers/demo/introduction/claim/INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Claim", status: "approved" }),
      "utf8",
    );
    const { unitCount, markdown } = await buildCombinedMarkdown(root, "papers/demo", false);
    expect(unitCount).toBe(1);
    expect(markdown).toContain("[@smith2024]");
  });

  it("strips duplicate unit H1 matching INDEX title", async () => {
    await seedPaper();
    await writeFile(
      path.join(root, "papers/demo/introduction/claim/draft.md"),
      "# Claim\n\nWe show that [@smith2024] matters.\n",
      "utf8",
    );
    const { markdown } = await buildCombinedMarkdown(root, "papers/demo", true);
    const claimHeadingCount = (markdown.match(/^#\s+Claim\s*$/gm) ?? []).length;
    expect(claimHeadingCount).toBe(0);
    expect(markdown).toContain("[@smith2024]");
  });
});

describe("findMissingCitations", () => {
  it("lists cite keys absent from bibliography", () => {
    const bib = "@article{smith2024,\n  title={X}\n}";
    expect(findMissingCitations("See [@smith2024] and [@missing]", bib)).toEqual(["missing"]);
  });
});

describe("buildBibliography", () => {
  it("builds bib entries for referenced keys", async () => {
    await seedPaper();
    const { markdown } = await buildCombinedMarkdown(root, "papers/demo", true);
    const bib = await buildBibliography(root, "papers/demo", markdown);
    expect(bib).toContain("@article{smith2024");
    expect(bib).toContain("Smith Paper");
  });
});

describe("resolveCslPath", () => {
  it("finds CSL under model/templates by journal slug", async () => {
    await mkdir(path.join(root, "templates"), { recursive: true });
    await writeFile(path.join(root, "templates", "plos-one.csl"), "<style/>", "utf8");
    expect(resolveCslPath(root, "PLOS ONE")).toContain("plos-one.csl");
  });
});
