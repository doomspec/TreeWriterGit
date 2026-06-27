import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";
import markdownDocx, { Packer } from "markdown-docx";
import JSZip from "jszip";

import { applyDocxOutlineComments } from "./exportDocxComments.js";
import {
  collectDocxOutlineComments,
  formatOutlineForDocxComment,
  insertDocxAbstractHeading,
} from "./exportDocxStructure.js";
import { buildMarkdownDocxExportOptions, postProcessDocxExport } from "./exportDocxStyle.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tw-docx-structure-"));
});

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await rm(root, { recursive: true, force: true });
});

describe("insertDocxAbstractHeading", () => {
  it("adds an Abstract heading before the first section", () => {
    const source = "# Paper Title\n\nAbstract body text.\n\n## Introduction\n\nIntro body.\n\n";
    const output = insertDocxAbstractHeading(source);
    expect(output).toContain("## Abstract\n\nAbstract body text.");
    expect(output).toContain("## Introduction\n\nIntro body.");
  });
});

describe("formatOutlineForDocxComment", () => {
  it("keeps summary text and strips outline link lists", () => {
    const output = formatOutlineForDocxComment(
      "# Intro\n\n## Summary\n\nPlanning note.\n\n## Outline\n- [Child](child/INDEX.md)\n",
    );
    expect(output).toBe("Planning note.");
  });
});

describe("collectDocxOutlineComments", () => {
  it("collects paper, section, subsection, and abstract outlines", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "introduction", "workflow"), { recursive: true });
    await mkdir(path.join(root, paperRel, "abstract"), { recursive: true });

    await writeFile(
      path.join(root, paperRel, "INDEX.md"),
      matter.stringify("", { kind: "paper", title: "Demo Paper", section_order: ["abstract", "introduction"] }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "outline.md"),
      "# Demo Paper\n\n## Summary\n\nPaper planning note.\n",
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "abstract", "INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Abstract" }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "abstract", "outline.md"),
      "# Abstract\n\n## Summary\n\nAbstract planning note.\n",
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "introduction", "INDEX.md"),
      matter.stringify("", {
        kind: "section",
        title: "Introduction",
        child_order: ["workflow"],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "introduction", "outline.md"),
      "# Introduction\n\n## Summary\n\nIntro planning note.\n",
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "introduction", "workflow", "INDEX.md"),
      matter.stringify("", { kind: "subsection", title: "Workflow Overview", child_order: [] }),
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "introduction", "workflow", "outline.md"),
      "# Workflow Overview\n\n## Summary\n\nWorkflow planning note.\n",
      "utf8",
    );

    const comments = await collectDocxOutlineComments(root, paperRel);
    const headings = comments.map((entry) => entry.heading);
    expect(headings).toContain("Demo Paper");
    expect(headings).toContain("Abstract");
    expect(headings).toContain("Introduction");
    expect(headings).toContain("Workflow Overview");
  });
});

describe("applyDocxOutlineComments", () => {
  it("writes comments.xml and marks heading paragraphs", async () => {
    const doc = await markdownDocx(
      "# Demo Paper\n\n## Introduction\n\nBody.",
      buildMarkdownDocxExportOptions(async () => null),
    );
    const raw = await Packer.toBuffer(doc);
    const patched = await applyDocxOutlineComments(Buffer.from(raw), [
      { heading: "Demo Paper", comment: "Paper outline note." },
      { heading: "Introduction", comment: "Section outline note." },
    ]);

    const zip = await JSZip.loadAsync(patched);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const commentsXml = await zip.file("word/comments.xml")!.async("string");
    const relsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");

    expect(documentXml).toContain("commentRangeStart");
    expect(documentXml).toContain("commentReference");
    expect(commentsXml).toContain("Paper outline note.");
    expect(commentsXml).toContain("Section outline note.");
    expect(relsXml).toContain("comments.xml");
  });
});

describe("postProcessDocxExport with outline comments", () => {
  it("applies fonts, strips MdSpace, and embeds comments", async () => {
    const doc = await markdownDocx(
      "# Demo Paper\n\n## Abstract\n\nAbstract text.\n",
      buildMarkdownDocxExportOptions(async () => null),
    );
    const raw = await Packer.toBuffer(doc);
    const patched = await postProcessDocxExport(Buffer.from(raw), [
      { heading: "Demo Paper", comment: "Paper note." },
      { heading: "Abstract", comment: "Abstract note." },
    ]);

    const zip = await JSZip.loadAsync(patched);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    expect(documentXml).not.toContain('w:val="MdSpace"');
    expect(documentXml).toContain("commentReference");
    expect(await zip.file("word/comments.xml")!.async("string")).toContain("Abstract note.");
  });
});
