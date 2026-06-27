import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  buildNatureMainTexDocument,
  classifyNatureSectionSlugs,
  copyJournalTemplateBundle,
  usesNatureLatexTemplate,
} from "./exportNature.js";
import { parseJournalExportStyle } from "./journalExportStyle.js";

describe("classifyNatureSectionSlugs", () => {
  it("routes methods and supplementary sections separately from body", () => {
    const roles = classifyNatureSectionSlugs([
      "introduction",
      "results",
      "discussion",
      "methods",
      "supplementary-information",
    ]);
    expect(roles.body).toEqual(["introduction", "results", "discussion"]);
    expect(roles.methods).toBe("methods");
    expect(roles.supplementary).toBe("supplementary-information");
  });
});

describe("buildNatureMainTexDocument", () => {
  it("follows sedimentorc nature-template section order", () => {
    const mainTex = buildNatureMainTexDocument({
      title: "Demo Paper",
      bodySections: ["introduction", "results"],
      methodsSection: "methods",
      supplementarySection: "supplementary-information",
    });
    expect(mainTex).toContain("\\documentclass{nature}");
    expect(mainTex).toContain("\\input{preamble.tex}");
    expect(mainTex).toContain("\\bibliographystyle{naturemag}");
    expect(mainTex).toContain("\\beginbodyfigures");
    expect(mainTex).toContain("\\input{sections/introduction}");
    expect(mainTex).toContain("\\input{sections/methods}");
    expect(mainTex).toContain("\\bibliography{references}");
    expect(mainTex).toContain("\\beginedfigures");
    expect(mainTex).toContain("\\input{sections/supplementary-information}");
  });
});

describe("usesNatureLatexTemplate", () => {
  it("detects nature export style with bundled assets", () => {
    expect(
      usesNatureLatexTemplate(
        parseJournalExportStyle({
          documentclass: "nature",
          template_bundle: "nature-latex",
          bib_style: "naturemag",
        }),
      ),
    ).toBe(true);
    expect(usesNatureLatexTemplate(parseJournalExportStyle({ documentclass: "article" }))).toBe(false);
  });
});

describe("copyJournalTemplateBundle", () => {
  let modelRoot: string;
  let targetDir: string;

  beforeEach(async () => {
    modelRoot = await mkdtemp(path.join(tmpdir(), "tw-nature-bundle-"));
    targetDir = path.join(modelRoot, "out");
    await mkdir(path.join(modelRoot, "templates", "nature-latex"), { recursive: true });
    await writeFile(path.join(modelRoot, "templates", "nature-latex", "nature.cls"), "% cls", "utf8");
    await writeFile(path.join(modelRoot, "templates", "nature-latex", "naturemag.bst"), "% bst", "utf8");
  });

  afterEach(async () => {
    await rm(modelRoot, { recursive: true, force: true });
  });

  it("copies bundled LaTeX assets into the export directory", async () => {
    const copied = await copyJournalTemplateBundle(modelRoot, "nature-latex", targetDir);
    expect(copied.sort()).toEqual(["nature.cls", "naturemag.bst"]);
  });
});
