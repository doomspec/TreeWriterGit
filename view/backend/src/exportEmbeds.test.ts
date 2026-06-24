import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import {
  buildFigureLatexExport,
  buildTableMarkdownExport,
  expandManuscriptEmbedsForExport,
} from "./exportEmbeds.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tw-export-embeds-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seedFigureUnit(): Promise<void> {
  const figureRel = "papers/demo/figures/fig1";
  await mkdir(path.join(root, figureRel), { recursive: true });
  await writeFile(
    path.join(root, figureRel, "INDEX.md"),
    matter.stringify("", {
      kind: "figure",
      title: "Fig1",
      status: "approved",
      figure_preview: "fig1-workflow.png",
      figure_source: "fig1-workflow.png",
    }),
    "utf8",
  );
  await writeFile(
    path.join(root, figureRel, "draft.md"),
    "**Fig1.** Workflow overview with live/dead cells.",
    "utf8",
  );
  await writeFile(path.join(root, figureRel, "fig1-workflow.png"), "PNG", "utf8");
}

async function seedTableUnit(): Promise<void> {
  const tableRel = "papers/demo/tables/summary";
  await mkdir(path.join(root, tableRel), { recursive: true });
  await writeFile(
    path.join(root, tableRel, "INDEX.md"),
    matter.stringify("", {
      kind: "table",
      title: "Summary table",
      status: "approved",
      table_label: "tab:summary",
    }),
    "utf8",
  );
  await writeFile(
    path.join(root, tableRel, "draft.md"),
    "**Table 1.** _Model comparison._\n\n| Model | Score |\n| --- | --- |\n| A | 0.91 |\n",
    "utf8",
  );
}

describe("buildFigureLatexExport", () => {
  it("builds a figure environment with escaped caption and label", async () => {
    await seedFigureUnit();
    const { resolveFigureMetadata } = await import("./figures.js");
    const meta = await resolveFigureMetadata(root, "papers/demo/figures/fig1");
    const { latex, assetPath } = buildFigureLatexExport(meta);
    expect(assetPath).toBe("papers/demo/figures/fig1/fig1-workflow.png");
    expect(latex).toContain("\\begin{figure}");
    expect(latex).toContain("\\includegraphics[width=0.9\\linewidth]{fig1-workflow.png}");
    expect(latex).toContain("\\caption{Fig1. Workflow overview with live/dead cells.}");
    expect(latex).toContain("\\label{fig:fig1}");
  });
});

describe("buildTableMarkdownExport", () => {
  it("converts table draft to pandoc table caption format", async () => {
    await seedTableUnit();
    const { resolveTableMetadata } = await import("./tables.js");
    const meta = await resolveTableMetadata(root, "papers/demo/tables/summary");
    const markdown = await buildTableMarkdownExport(root, meta);
    expect(markdown).toContain("Table: Table 1. Model comparison. {#tab:summary}");
    expect(markdown).toContain("| Model | Score |");
  });
});

describe("expandManuscriptEmbedsForExport", () => {
  it("expands ::figure embeds and collects asset paths", async () => {
    await seedFigureUnit();
    const source = "See (Fig.\n::figure[papers/demo/figures/fig1]\n).";
    const { markdown, assets } = await expandManuscriptEmbedsForExport(root, source);
    expect(assets).toEqual(["papers/demo/figures/fig1/fig1-workflow.png"]);
    expect(markdown).toContain("(Fig.~\\ref{fig:fig1}).");
    expect(markdown).toContain("\\begin{figure}");
    expect(markdown).toContain("Fig1. Workflow overview");
    expect(markdown).not.toContain("::figure[");
    expect(markdown.indexOf("(Fig.")).toBeLessThan(markdown.indexOf("\\begin{figure}"));
  });

  it("expands standalone table wikilinks to table markdown", async () => {
    await seedTableUnit();
    const source = "[[papers/demo/tables/summary|Table 1]]\n\n**Table 1.** _Model comparison._";
    const { markdown } = await expandManuscriptEmbedsForExport(root, source);
    expect(markdown).toContain("Table: Table 1. Model comparison. {#tab:summary}");
    expect(markdown).toContain("| Model | Score |");
  });
});
