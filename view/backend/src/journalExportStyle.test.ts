import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  appendPandocExportStyleArgs,
  buildCombinedExportHeader,
  buildJournalLatexHeader,
  parseJournalExportStyle,
} from "./journalExportStyle.js";

describe("parseJournalExportStyle", () => {
  it("parses export frontmatter block", () => {
    const style = parseJournalExportStyle({
      documentclass: "article",
      documentclass_options: ["11pt", "twocolumn"],
      geometry: "margin=2.5cm",
      csl: "nature.csl",
      pandoc_variables: { linestretch: "1.15", fontsize: "11pt" },
      latex_header: "\\usepackage{microtype}",
      include_header: "nature-preamble.tex",
      template_bundle: "nature-latex",
      bib_style: "naturemag",
    });
    expect(style).toEqual({
      documentclass: "article",
      documentclassOptions: ["11pt", "twocolumn"],
      geometry: "margin=2.5cm",
      csl: "nature.csl",
      pandocVariables: { linestretch: "1.15", fontsize: "11pt" },
      latexHeader: "\\usepackage{microtype}",
      includeHeader: "nature-preamble.tex",
      templateBundle: "nature-latex",
      bibStyle: "naturemag",
    });
  });

  it("returns undefined for empty or invalid input", () => {
    expect(parseJournalExportStyle(undefined)).toBeUndefined();
    expect(parseJournalExportStyle({})).toBeUndefined();
  });
});

describe("buildJournalLatexHeader", () => {
  it("builds geometry and custom latex lines", () => {
    const header = buildJournalLatexHeader({
      geometry: "margin=2.5cm",
      latexHeader: "\\usepackage{microtype}",
    });
    expect(header).toContain("\\usepackage[margin=2.5cm]{geometry}");
    expect(header).toContain("\\usepackage{microtype}");
  });
});

describe("buildCombinedExportHeader", () => {
  let modelRoot: string;

  beforeEach(async () => {
    modelRoot = await mkdtemp(path.join(tmpdir(), "tw-journal-export-"));
  });

  afterEach(async () => {
    await rm(modelRoot, { recursive: true, force: true });
  });

  it("merges template include file and inline note preamble", async () => {
    await mkdir(path.join(modelRoot, "templates"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "templates", "nature-preamble.tex"),
      "\\usepackage{setspace}",
      "utf8",
    );
    const combined = await buildCombinedExportHeader(
      modelRoot,
      {
        geometry: "margin=2cm",
        includeHeader: "nature-preamble.tex",
      },
      "\\newcommand{\\note}[1]{\\textit{#1}}",
    );
    expect(combined).toContain("\\usepackage[margin=2cm]{geometry}");
    expect(combined).toContain("\\usepackage{setspace}");
    expect(combined).toContain("\\newcommand{\\note}");
  });
});

describe("appendPandocExportStyleArgs", () => {
  it("adds pandoc -V flags", () => {
    const args: string[] = [];
    appendPandocExportStyleArgs(args, {
      documentclass: "article",
      documentclassOptions: ["11pt"],
      pandocVariables: { linestretch: "1.2" },
    });
    expect(args).toEqual([
      "-V",
      "documentclass=article",
      "-V",
      "classoption=11pt",
      "-V",
      "linestretch=1.2",
    ]);
  });
});
