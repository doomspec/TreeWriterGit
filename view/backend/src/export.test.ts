import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import { buildBibliography, buildCombinedMarkdown, buildSectionMarkdown, exportPaper, extractCiteKeys, findMissingCitations, formatSectionOutlineNoteForExport, resolveCslPath } from "./export.js";
import {
  buildHighlightColorLatexPreamble,
  prepareMarkdownForLatexExport,
} from "./exportMarkdown.js";

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

  it("never includes temp-notes scratchpad content", async () => {
    await seedPaper();
    await writeFile(
      path.join(root, "papers/demo/introduction/temp-notes.md"),
      "# Scratch\n\nSecret local notes that must not export.\n",
      "utf8",
    );
    const { markdown } = await buildCombinedMarkdown(root, "papers/demo", true);
    expect(markdown).not.toContain("Secret local notes");
    expect(markdown).not.toContain("temp-notes");
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

  it("includes subsection subtitles but not unit titles in nested trees", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "results", "workflow", "claim"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "INDEX.md"),
      matter.stringify("", {
        kind: "paper",
        title: "Demo Paper",
        section_order: ["results"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/INDEX.md"),
      matter.stringify("", {
        kind: "section",
        title: "Results",
        child_order: ["workflow", "standalone"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/workflow/INDEX.md"),
      matter.stringify("", {
        kind: "section",
        title: "Workflow Overview",
        child_order: ["claim"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/workflow/claim/INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Claim paragraph", status: "approved" }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/workflow/claim/draft.md"),
      "## Claim paragraph\n\nApproved unit prose.\n",
      "utf8",
    );
    await mkdir(path.join(root, paperRel, "results/standalone"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "results/standalone/INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Standalone unit", status: "approved" }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/standalone/draft.md"),
      "# Standalone unit\n\nStandalone prose.\n",
      "utf8",
    );

    const { markdown } = await buildCombinedMarkdown(root, paperRel, false);
    expect(markdown).toContain("## Results");
    expect(markdown).toContain("### Workflow Overview");
    expect(markdown).toContain("Approved unit prose.");
    expect(markdown).toContain("Standalone prose.");
    expect(markdown).not.toMatch(/^#{1,6}\s+Claim paragraph\s*$/m);
    expect(markdown).not.toMatch(/^#{1,6}\s+Standalone unit\s*$/m);
  });

  it("omits empty subsection subtitles when no exportable units exist", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "results", "empty-subsection", "draft-unit"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, paperRel, "INDEX.md"),
      matter.stringify("", {
        kind: "paper",
        title: "Demo Paper",
        section_order: ["results"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/INDEX.md"),
      matter.stringify("", {
        kind: "section",
        title: "Results",
        child_order: ["empty-subsection", "filled-subsection"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/empty-subsection/INDEX.md"),
      matter.stringify("", {
        kind: "section",
        title: "Empty Subsection",
        child_order: ["draft-unit"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/empty-subsection/draft-unit/INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Draft only", status: "draft" }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/empty-subsection/draft-unit/draft.md"),
      "Should not export.",
      "utf8",
    );
    await mkdir(path.join(root, paperRel, "results/filled-subsection", "claim"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "results/filled-subsection/INDEX.md"),
      matter.stringify("", {
        kind: "section",
        title: "Filled Subsection",
        child_order: ["claim"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/filled-subsection/claim/INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Claim", status: "approved" }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "results/filled-subsection/claim/draft.md"),
      "Filled subsection prose.",
      "utf8",
    );

    const { markdown } = await buildCombinedMarkdown(root, paperRel, false);
    expect(markdown).not.toContain("### Empty Subsection");
    expect(markdown).toContain("### Filled Subsection");
    expect(markdown).toContain("Filled subsection prose.");
    expect(markdown).not.toContain("Should not export.");
  });

  it("falls back to outline.md when draft is empty and includeDrafts is true", async () => {
    await seedPaper();
    await writeFile(path.join(root, "papers/demo/introduction/claim/draft.md"), "", "utf8");
    await writeFile(
      path.join(root, "papers/demo/introduction/claim/outline.md"),
      "# Claim\n\nOutline prose for export.\n",
      "utf8",
    );
    const { markdown, unitCount } = await buildCombinedMarkdown(root, "papers/demo", true);
    expect(unitCount).toBe(1);
    expect(markdown).toContain("Outline prose for export.");
  });

  it("does not fall back to outline when includeDrafts is false", async () => {
    await seedPaper();
    await writeFile(path.join(root, "papers/demo/introduction/claim/draft.md"), "", "utf8");
    await writeFile(
      path.join(root, "papers/demo/introduction/claim/INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Claim", status: "approved" }),
      "utf8",
    );
    const { unitCount } = await buildCombinedMarkdown(root, "papers/demo", false);
    expect(unitCount).toBe(0);
  });

  it("skips unit outlines when includeUnitOutlines is false", async () => {
    await seedPaper();
    await writeFile(path.join(root, "papers/demo/introduction/claim/draft.md"), "", "utf8");
    await writeFile(
      path.join(root, "papers/demo/introduction/claim/outline.md"),
      "# Claim\n\nUnit outline only.\n",
      "utf8",
    );
    const { markdown, unitCount } = await buildSectionMarkdown(
      root,
      "papers/demo/introduction",
      "Introduction",
      true,
      { includeUnitOutlines: false },
    );
    expect(unitCount).toBe(0);
    expect(markdown).not.toContain("Unit outline only");
  });
});

describe("formatSectionOutlineNoteForExport", () => {
  it("wraps section outline text in a LaTeX planning-note block", () => {
    const note = formatSectionOutlineNoteForExport(
      "## Summary\n\n- Planning bullet\n\n## Outline\n\n- [Background](background/INDEX.md)\n",
    );
    expect(note).toContain("\\begin{sectionoutline}");
    expect(note).toContain("Planning bullet");
    expect(note).toContain("Background");
    expect(note).not.toContain("background/INDEX.md");
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

  it("prefers export.csl from journal template over slug", async () => {
    await mkdir(path.join(root, "templates"), { recursive: true });
    await writeFile(path.join(root, "templates", "custom.csl"), "<style/>", "utf8");
    await writeFile(path.join(root, "templates", "nature.csl"), "<style/>", "utf8");
    expect(resolveCslPath(root, "Nature", "custom.csl")).toContain("custom.csl");
  });
});
