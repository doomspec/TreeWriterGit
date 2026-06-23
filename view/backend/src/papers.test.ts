import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import {
  collectContainerCounts,
  countUnitsUnder,
  deletePaper,
  getPaperDetail,
  listJournalTemplateDetails,
  listPapers,
  loadJournalTemplate,
  normalizeSectionOrder,
  scaffoldPaper,
  slugify,
  updatePaper,
} from "./papers.js";
import { ModelFsError } from "./modelFs.js";
import { buildCombinedMarkdown } from "./export.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-papers-"));
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

async function writeIndex(rel: string, data: Record<string, unknown>, body = "") {
  const abs = path.join(modelRoot, rel);
  await mkdir(abs, { recursive: true });
  await writeFile(path.join(abs, "INDEX.md"), matter.stringify(body, data), "utf8");
}

describe("countUnitsUnder vs export walk", () => {
  it("counts the same exportable units as buildCombinedMarkdown", async () => {
    await writeIndex("papers/demo", {
      kind: "paper",
      title: "Demo",
      section_order: ["sections"],
    });
    await writeIndex("papers/demo/sections", {
      kind: "section",
      child_order: ["intro", "extra-on-disk"],
    });
    await writeIndex("papers/demo/sections/intro", { kind: "section", child_order: ["problem"] });
    await writeIndex("papers/demo/sections/intro/problem", {
      kind: "unit",
      title: "Problem",
      status: "drafted",
    });
    await mkdir(path.join(modelRoot, "papers/demo/sections/intro/problem"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/sections/intro/problem/draft.md"),
      "# Problem\n\nBody text.\n",
      "utf8",
    );

    await writeIndex("papers/demo/sections/extra-on-disk", {
      kind: "section",
      child_order: ["claim"],
    });
    await writeIndex("papers/demo/sections/extra-on-disk/claim", {
      kind: "unit",
      title: "Claim",
      status: "drafted",
    });
    await mkdir(path.join(modelRoot, "papers/demo/sections/extra-on-disk/claim"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/sections/extra-on-disk/claim/draft.md"),
      "Another unit.\n",
      "utf8",
    );

    const counts = await countUnitsUnder(modelRoot, "papers/demo");
    const { unitCount } = await buildCombinedMarkdown(modelRoot, "papers/demo", true);
    expect(counts.total).toBe(2);
    expect(unitCount).toBe(2);
  });
});

async function writeUnit(rel: string, status: string) {
  await writeIndex(rel, { kind: "unit", title: rel.split("/").at(-1), status });
  await writeFile(path.join(modelRoot, rel, "draft.md"), "Body.\n", "utf8");
}

async function writeTemplate(key: string, data: Record<string, unknown>) {
  const dir = path.join(modelRoot, "templates");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${key}.md`), matter.stringify("# Template\n", data), "utf8");
}

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Great Paper")).toBe("my-great-paper");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("RoboCulture: A Platform!! (v2)")).toBe("roboculture-a-platform-v2");
  });

  it("trims leading/trailing hyphens and caps length", () => {
    expect(slugify("  --Hello--  ")).toBe("hello");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(64);
  });

  it("throws 400 when nothing slug-able remains", () => {
    expect(() => slugify("!!! ??? ...")).toThrowError(ModelFsError);
  });
});

describe("normalizeSectionOrder", () => {
  it("slugifies section names", () => {
    expect(normalizeSectionOrder(["Introduction", "Results and Discussion"])).toEqual([
      "introduction",
      "results-and-discussion",
    ]);
  });

  it("rejects empty section lists and duplicates", () => {
    expect(() => normalizeSectionOrder(["", "  "])).toThrowError(ModelFsError);
    expect(() => normalizeSectionOrder(["intro", "Intro"])).toThrowError(ModelFsError);
  });
});

describe("listJournalTemplateDetails", () => {
  it("returns full template metadata", async () => {
    await writeTemplate("digital-discovery", {
      journal: "Digital Discovery",
      target_words: 6000,
      section_order: ["abstract", "introduction"],
    });
    const templates = await listJournalTemplateDetails(modelRoot);
    const dd = templates.find((template) => template.journal === "Digital Discovery");
    expect(dd?.targetWords).toBe(6000);
    expect(dd?.sectionOrder).toEqual(["abstract", "introduction"]);
  });
});

describe("countUnitsUnder status bucketing", () => {
  it("buckets approved / drafted / outline separately", async () => {
    await writeIndex("papers/p", { kind: "paper", section_order: ["sections"] });
    await writeIndex("papers/p/sections", {
      kind: "section",
      child_order: ["a", "b", "c"],
    });
    await writeUnit("papers/p/sections/a", "approved");
    await writeUnit("papers/p/sections/b", "drafted");
    await writeUnit("papers/p/sections/c", "outline");

    const counts = await countUnitsUnder(modelRoot, "papers/p");
    expect(counts).toEqual({ approved: 1, drafted: 1, outline: 1, total: 3 });
  });

  it("buckets unknown / legacy statuses into outline (never lost)", async () => {
    await writeIndex("papers/p/sections", { kind: "section", child_order: ["x", "y", "z"] });
    await writeUnit("papers/p/sections/x", "draft"); // legacy spelling
    await writeUnit("papers/p/sections/y", "submitted"); // unknown
    await writeIndex("papers/p/sections/z", { kind: "unit", title: "z" }); // no status field
    await writeFile(path.join(modelRoot, "papers/p/sections/z/draft.md"), "Body.\n", "utf8");

    const counts = await countUnitsUnder(modelRoot, "papers/p/sections");
    expect(counts.outline).toBe(3);
    expect(counts.approved).toBe(0);
    expect(counts.drafted).toBe(0);
    expect(counts.total).toBe(3);
  });

  it("skips units under a notes/ subtree", async () => {
    await writeIndex("papers/p/sections", { kind: "section", child_order: ["real"] });
    await writeUnit("papers/p/sections/real", "drafted");
    await writeUnit("papers/p/notes/literature/ref", "drafted");

    const counts = await countUnitsUnder(modelRoot, "papers/p");
    expect(counts.total).toBe(1);
    expect(counts.drafted).toBe(1);
  });
});

describe("loadJournalTemplate", () => {
  it("loads the matching journal template by slug key", async () => {
    await writeTemplate("nature", {
      journal: "Nature",
      target_words: 3000,
      section_order: ["introduction", "results", "methods"],
      export: {
        documentclass: "article",
        documentclass_options: ["11pt"],
        geometry: "margin=2.5cm",
        pandoc_variables: { linestretch: "1.15" },
      },
    });
    const tpl = await loadJournalTemplate(modelRoot, "Nature");
    expect(tpl.journal).toBe("Nature");
    expect(tpl.targetWords).toBe(3000);
    expect(tpl.sectionOrder).toEqual(["introduction", "results", "methods"]);
    expect(tpl.export?.documentclass).toBe("article");
    expect(tpl.export?.documentclassOptions).toEqual(["11pt"]);
    expect(tpl.export?.pandocVariables?.linestretch).toBe("1.15");
  });

  it("falls back to plos-one when the journal key is absent", async () => {
    await writeTemplate("plos-one", {
      journal: "PLOS ONE",
      section_order: ["introduction", "methods"],
    });
    const tpl = await loadJournalTemplate(modelRoot, "Some Unknown Journal");
    expect(tpl.journal).toBe("PLOS ONE");
  });

  it("throws 404 when no template resolves", async () => {
    await expect(loadJournalTemplate(modelRoot, "Nature")).rejects.toThrowError(ModelFsError);
  });
});

describe("scaffoldPaper + listPapers + getPaperDetail", () => {
  beforeEach(async () => {
    await writeTemplate("plos-one", {
      journal: "PLOS ONE",
      target_words: 5000,
      section_order: ["introduction", "methods", "results"],
    });
  });

  it("scaffolds a paper with slug, sections, and notes", async () => {
    const { slug, path: paperRel } = await scaffoldPaper(modelRoot, {
      title: "My Study",
      journal: "PLOS ONE",
      authors: ["Ada Lovelace"],
    });
    expect(slug).toBe("my-study");
    expect(paperRel).toBe("papers/my-study");

    const paperIndex = matter(
      await readFile(path.join(modelRoot, "papers/my-study/INDEX.md"), "utf8"),
    );
    expect(paperIndex.data.kind).toBe("paper");
    // template sections lead the order; asset folders live outside section_order
    expect((paperIndex.data.section_order as string[]).slice(0, 3)).toEqual([
      "introduction",
      "methods",
      "results",
    ]);
    expect(paperIndex.data.authors).toEqual(["Ada Lovelace"]);

    for (const section of ["introduction", "methods", "results"]) {
      expect(existsSync(path.join(modelRoot, `papers/my-study/${section}/INDEX.md`))).toBe(true);
    }
    for (const notesDir of ["literature", "data", "feedback"]) {
      expect(existsSync(path.join(modelRoot, `papers/my-study/notes/${notesDir}`))).toBe(true);
    }
  });

  it("applies custom settings overrides from the create request", async () => {
    const { slug } = await scaffoldPaper(modelRoot, {
      title: "Custom Settings",
      journal: "PLOS ONE",
      authors: ["Ada Lovelace"],
      targetWords: 7500,
      sectionOrder: ["Abstract", "Intro", "Results"],
      status: "Drafting",
      overleafRepoPath: "/tmp/overleaf",
    });
    expect(slug).toBe("custom-settings");

    const paperIndex = matter(
      await readFile(path.join(modelRoot, "papers/custom-settings/INDEX.md"), "utf8"),
    );
    expect(paperIndex.data.target_words).toBe(7500);
    expect((paperIndex.data.section_order as string[]).slice(0, 3)).toEqual([
      "abstract",
      "intro",
      "results",
    ]);
    expect(paperIndex.data.section_order).toEqual(["abstract", "intro", "results"]);
    expect(paperIndex.data.status).toBe("Drafting");
    expect(paperIndex.data.overleaf_repo_path).toBe("/tmp/overleaf");

    for (const section of ["abstract", "intro", "results"]) {
      expect(existsSync(path.join(modelRoot, `papers/custom-settings/${section}/INDEX.md`))).toBe(
        true,
      );
    }
  });

  it("rejects a duplicate slug with 409", async () => {
    await scaffoldPaper(modelRoot, { title: "Dup", journal: "PLOS ONE", authors: [] });
    await expect(
      scaffoldPaper(modelRoot, { title: "Dup", journal: "PLOS ONE", authors: [] }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lists only kind:paper directories with rolled-up counts", async () => {
    await scaffoldPaper(modelRoot, { title: "Paper One", journal: "PLOS ONE", authors: [] });
    // a stray non-paper directory under papers/ must be ignored
    await writeIndex("papers/not-a-paper", { kind: "section" });

    const papers = await listPapers(modelRoot);
    expect(papers).toHaveLength(1);
    expect(papers[0].slug).toBe("paper-one");
    expect(papers[0].counts.total).toBe(0); // freshly scaffolded: no units yet
  });

  it("returns per-section roll-up in getPaperDetail", async () => {
    await scaffoldPaper(modelRoot, { title: "Detail", journal: "PLOS ONE", authors: [] });
    await writeUnit("papers/detail/introduction/opening", "drafted");
    await writeIndex("papers/detail/introduction", {
      kind: "section",
      child_order: ["opening"],
    });

    const detail = await getPaperDetail(modelRoot, "detail");
    expect(detail.sections.map((s) => s.title)).toContain("Introduction");
    const intro = detail.sections.find((s) => s.path.endsWith("/introduction"));
    expect(intro?.counts.drafted).toBe(1);
    expect(detail.counts.drafted).toBe(1);
  });

  it("returns containerCounts for sections, subsections, and units", async () => {
    await scaffoldPaper(modelRoot, { title: "Rollup", journal: "PLOS ONE", authors: [] });
    await writeIndex("papers/rollup/methods", {
      kind: "section",
      child_order: ["prep"],
    });
    await writeIndex("papers/rollup/methods/prep", {
      kind: "subsection",
      child_order: ["step-a"],
    });
    await writeUnit("papers/rollup/methods/prep/step-a", "approved");

    const counts = await collectContainerCounts(modelRoot, "papers/rollup");
    expect(counts["papers/rollup"].approved).toBe(1);
    expect(counts["papers/rollup/methods"].approved).toBe(1);
    expect(counts["papers/rollup/methods/prep"].approved).toBe(1);
    expect(counts["papers/rollup/methods/prep/step-a"].approved).toBe(1);

    const detail = await getPaperDetail(modelRoot, "rollup");
    expect(detail.containerCounts["papers/rollup/methods/prep/step-a"].total).toBe(1);
  });

  it("returns pendingApprovalPaths for unapproved draft and outline files", async () => {
    await scaffoldPaper(modelRoot, { title: "Pending", journal: "PLOS ONE", authors: [] });
    await writeUnit("papers/pending/introduction/unit-a", "approved");
    await writeFile(
      path.join(modelRoot, "papers/pending/introduction/unit-a/draft.md"),
      "Changed body.\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/pending/introduction/unit-a/outline.md"),
      "Changed outline.\n",
      "utf8",
    );

    const detail = await getPaperDetail(modelRoot, "pending");
    expect(detail.pendingApprovalPaths).toContain("papers/pending/introduction/unit-a/draft.md");
    expect(detail.pendingApprovalPaths).toContain("papers/pending/introduction/unit-a/outline.md");
  });

  it("throws 404 for an unknown paper slug", async () => {
    await expect(getPaperDetail(modelRoot, "ghost")).rejects.toMatchObject({ status: 404 });
  });
});

describe("updatePaper + deletePaper", () => {
  beforeEach(async () => {
    await writeTemplate("plos-one", {
      journal: "PLOS ONE",
      target_words: 5000,
      section_order: ["introduction", "methods", "results"],
    });
    await scaffoldPaper(modelRoot, {
      title: "Original Title",
      journal: "PLOS ONE",
      authors: ["Ada Lovelace"],
      slug: "editable",
    });
  });

  it("updates paper metadata in INDEX.md", async () => {
    await updatePaper(modelRoot, {
      slug: "editable",
      title: "Updated Title",
      journal: "PLOS ONE",
      authors: ["Ada Lovelace", "Bob Jones"],
      targetWords: 8000,
      sectionOrder: ["abstract", "introduction"],
      status: "Drafting",
      overleafRepoPath: "/tmp/overleaf",
    });

    const paperIndex = matter(
      await readFile(path.join(modelRoot, "papers/editable/INDEX.md"), "utf8"),
    );
    expect(paperIndex.data.title).toBe("Updated Title");
    expect(paperIndex.content).toContain("# Updated Title");
    expect(paperIndex.data.authors).toEqual(["Ada Lovelace", "Bob Jones"]);
    expect(paperIndex.data.target_words).toBe(8000);
    expect(paperIndex.data.section_order).toEqual(["abstract", "introduction"]);
    expect(paperIndex.data.status).toBe("Drafting");
    expect(paperIndex.data.overleaf_repo_path).toBe("/tmp/overleaf");

    const detail = await getPaperDetail(modelRoot, "editable");
    expect(detail.title).toBe("Updated Title");
    expect(detail.authors).toEqual(["Ada Lovelace", "Bob Jones"]);
    expect(detail.targetWords).toBe(8000);
  });

  it("deletes a paper recursively", async () => {
    await deletePaper(modelRoot, "editable");
    expect(existsSync(path.join(modelRoot, "papers/editable"))).toBe(false);
    await expect(getPaperDetail(modelRoot, "editable")).rejects.toMatchObject({ status: 404 });
  });
});
