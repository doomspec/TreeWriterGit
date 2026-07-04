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

  it("renders structured authors with superscript affiliation numbers and affiliation items", () => {
    const mainTex = buildNatureMainTexDocument({
      title: "Demo Paper",
      authors: [
        { firstName: "Ada", lastName: "Lovelace", affiliations: [1] },
        { firstName: "Alan", lastName: "Turing", affiliations: [1, 2] },
      ],
      affiliations: ["Dept of Computing, Cambridge", "Bletchley Park"],
      bodySections: ["introduction"],
    });
    expect(mainTex).toContain("\\author{Ada Lovelace$^{1}$, Alan Turing$^{1,2}$}");
    expect(mainTex).toContain("\\item Dept of Computing, Cambridge");
    expect(mainTex).toContain("\\item Bletchley Park");
    expect(mainTex).not.toContain("Author names TBD");
  });

  it("adds equal-contribution (†), corresponding (*), and ORCID notes", () => {
    const mainTex = buildNatureMainTexDocument({
      title: "Demo",
      authors: [
        { firstName: "Ada", lastName: "Lovelace", affiliations: [1], equalContribution: true, orcid: "0000-0002-1825-0097" },
        { firstName: "Alan", lastName: "Turing", affiliations: [1], equalContribution: true, corresponding: true, email: "alan@x.org" },
      ],
      affiliations: ["Cambridge"],
      bodySections: ["introduction"],
    });
    expect(mainTex).toContain("Ada Lovelace$^{1,\\dagger}$");
    expect(mainTex).toContain("Alan Turing$^{1,\\dagger,*}$");
    expect(mainTex).toContain("\\item[$\\dagger$] These authors contributed equally.");
    expect(mainTex).toContain("\\item[$*$] Correspondence: Alan Turing (alan@x.org).");
    expect(mainTex).toContain("\\item[ORCID] Ada Lovelace — 0000-0002-1825-0097");
    // Dynamic notes replace the static correspondence line.
    expect(mainTex).not.toContain("addressed to the corresponding author");
  });

  it("emits a CRediT Author contributions statement from author roles", () => {
    const mainTex = buildNatureMainTexDocument({
      title: "Demo",
      authors: [
        { firstName: "Ada", lastName: "Lovelace", affiliations: [], credit: ["Conceptualization", "Software"] },
        { firstName: "Alan", lastName: "Turing", affiliations: [], credit: ["Methodology"] },
      ],
      bodySections: ["introduction"],
    });
    expect(mainTex).toContain("\\section*{Author contributions}");
    expect(mainTex).toContain("A. Lovelace: Conceptualization, Software.");
    expect(mainTex).toContain("A. Turing: Methodology.");
  });

  it("omits the CRediT statement when no author has roles", () => {
    const mainTex = buildNatureMainTexDocument({
      title: "Demo",
      authors: [{ firstName: "Ada", lastName: "Lovelace", affiliations: [] }],
      bodySections: ["introduction"],
    });
    expect(mainTex).not.toContain("Author contributions");
  });

  it("falls back to legacy author string / TBD placeholders when no authors are provided", () => {
    const mainTex = buildNatureMainTexDocument({
      title: "Demo",
      author: "Legacy Author",
      bodySections: ["introduction"],
    });
    expect(mainTex).toContain("\\author{Legacy Author}");
  });

  it("escapes LaTeX-special characters in author and affiliation text", () => {
    const mainTex = buildNatureMainTexDocument({
      title: "Demo",
      authors: [{ firstName: "A", lastName: "B_Lab", affiliations: [1] }],
      affiliations: ["Dept #3 & Co"],
      bodySections: ["introduction"],
    });
    expect(mainTex).toContain("A B\\_Lab");
    expect(mainTex).toContain("\\item Dept \\#3 \\& Co");
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
