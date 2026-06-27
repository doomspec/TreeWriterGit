import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import { buildSectionMarkdown } from "./export.js";
import { exportModularPaper } from "./exportModular.js";

let modelRoot = "";
let repoRoot = "";

async function seedPaper(): Promise<void> {
  const paperRel = "papers/demo";
  await mkdir(path.join(modelRoot, paperRel, "introduction", "claim"), { recursive: true });
  await mkdir(path.join(modelRoot, paperRel, "results", "finding"), { recursive: true });
  await mkdir(path.join(modelRoot, paperRel, "notes", "literature"), { recursive: true });

  await writeFile(
    path.join(modelRoot, paperRel, "INDEX.md"),
    matter.stringify("", {
      kind: "paper",
      title: "Demo Paper",
      section_order: ["introduction", "results"],
    }),
    "utf8",
  );

  for (const [section, unit, text] of [
    ["introduction", "claim", "Intro claim with [@smith2024]."],
    ["results", "finding", "Results finding text."],
  ] as const) {
    await writeFile(
      path.join(modelRoot, paperRel, section, "INDEX.md"),
      matter.stringify("", {
        kind: "section",
        title: section === "introduction" ? "Introduction" : "Results",
        child_order: [unit],
      }),
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, paperRel, section, "outline.md"),
      `# ${section === "introduction" ? "Introduction" : "Results"}\n\n## Summary\n\n- Section planning note for ${section}.\n`,
      "utf8",
    );
    await mkdir(path.join(modelRoot, paperRel, section, unit), { recursive: true });
    await writeFile(
      path.join(modelRoot, paperRel, section, unit, "INDEX.md"),
      matter.stringify("", { kind: "unit", title: unit, status: "approved" }),
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, paperRel, section, unit, "draft.md"),
      text,
      "utf8",
    );
  }

  await writeFile(
    path.join(modelRoot, paperRel, "notes", "literature", "smith2024.md"),
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
  const tmp = await mkdtemp(path.join(tmpdir(), "tw-modular-"));
  modelRoot = path.join(tmp, "model");
  repoRoot = path.join(tmp, "repo");
  await mkdir(modelRoot, { recursive: true });
  await mkdir(repoRoot, { recursive: true });
});

afterEach(async () => {
  await rm(path.dirname(modelRoot), { recursive: true, force: true });
});

describe("buildSectionMarkdown", () => {
  it("combines nested units within one section", async () => {
    await seedPaper();
    const { markdown, unitCount } = await buildSectionMarkdown(
      modelRoot,
      "papers/demo/introduction",
      "Introduction",
      false,
    );
    expect(unitCount).toBe(1);
    expect(markdown).toMatch(/^# Introduction/m);
    expect(markdown).toContain("[@smith2024]");
    expect(markdown).not.toContain("# Results");
  });
});

describe("exportModularPaper", () => {
  it("writes main.tex, references.bib, and per-section files", async () => {
    await seedPaper();
    const bundle = await exportModularPaper(modelRoot, repoRoot, {
      paperSlug: "demo",
      includeDrafts: false,
    });

    const bundleAbs = path.join(repoRoot, bundle.bundleDir);
    expect(existsSync(path.join(bundleAbs, "main.tex"))).toBe(true);
    expect(existsSync(path.join(bundleAbs, "references.bib"))).toBe(true);
    expect(existsSync(path.join(bundleAbs, "sections", "introduction.tex"))).toBe(true);
    expect(existsSync(path.join(bundleAbs, "sections", "results.tex"))).toBe(true);
    expect(existsSync(path.join(bundleAbs, "sections", "references.tex"))).toBe(true);

    const mainTex = await readFile(path.join(bundleAbs, "main.tex"), "utf8");
    expect(mainTex).toContain("\\input{sections/introduction}");
    expect(mainTex).toContain("\\input{sections/results}");
    expect(mainTex).toContain("\\input{sections/references}");
    expect(mainTex).toContain("\\end{document}");
    expect(mainTex).not.toContain("\\providecommand{\\textcolor}");

    const introTex = await readFile(path.join(bundleAbs, "sections", "introduction.tex"), "utf8");
    expect(introTex).toContain("\\section{Introduction}");
    expect(introTex).toContain("sectionoutline");
    expect(introTex).toContain("Section planning note for introduction");
    expect(introTex).not.toContain("\\begin{CSLReferences}");

    const sectionFiles = await readdir(path.join(bundleAbs, "sections"));
    expect(sectionFiles.filter((f) => f.endsWith(".tex")).length).toBeGreaterThanOrEqual(3);
  });

  it("does not export unit outlines as body text in modular export", async () => {
    await seedPaper();
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/claim/draft.md"),
      "",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/claim/outline.md"),
      "# Claim\n\nUnit outline only text.\n",
      "utf8",
    );

    const bundle = await exportModularPaper(modelRoot, repoRoot, {
      paperSlug: "demo",
      includeDrafts: true,
    });

    const introTex = await readFile(
      path.join(repoRoot, bundle.bundleDir, "sections", "introduction.tex"),
      "utf8",
    );
    expect(introTex).toContain("Section planning note for introduction");
    expect(introTex).not.toContain("Unit outline only text");
  });

  it("uses the Nature LaTeX template when the paper journal is Nature", async () => {
    await seedPaper();
    await mkdir(path.join(modelRoot, "templates", "nature-latex"), { recursive: true });
    await writeFile(path.join(modelRoot, "templates", "nature-latex", "nature.cls"), "% cls", "utf8");
    await writeFile(path.join(modelRoot, "templates", "nature-latex", "preamble.tex"), "% preamble", "utf8");
    await writeFile(
      path.join(modelRoot, "templates", "nature.md"),
      matter.stringify("# Nature\n", {
        journal: "Nature",
        section_order: ["introduction", "results", "methods"],
        export: {
          documentclass: "nature",
          template_bundle: "nature-latex",
          bib_style: "naturemag",
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/INDEX.md"),
      matter.stringify("", {
        kind: "paper",
        title: "Demo Paper",
        journal: "Nature",
        section_order: ["introduction", "results", "methods"],
      }),
      "utf8",
    );
    await mkdir(path.join(modelRoot, "papers/demo/methods", "protocol"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/methods/INDEX.md"),
      matter.stringify("", { kind: "section", title: "Methods", child_order: ["protocol"] }),
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/methods/protocol/INDEX.md"),
      matter.stringify("", { kind: "unit", title: "Protocol", status: "approved" }),
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/methods/protocol/draft.md"),
      "Methods text.",
      "utf8",
    );

    const bundle = await exportModularPaper(modelRoot, repoRoot, {
      paperSlug: "demo",
      includeDrafts: false,
    });

    const bundleAbs = path.join(repoRoot, bundle.bundleDir);
    const mainTex = await readFile(path.join(bundleAbs, "main.tex"), "utf8");
    expect(mainTex).toContain("\\documentclass{nature}");
    expect(mainTex).toContain("\\input{preamble.tex}");
    expect(mainTex).toContain("\\input{sections/introduction}");
    expect(mainTex).toContain("\\input{sections/results}");
    expect(mainTex).toContain("\\input{sections/methods}");
    expect(mainTex).toContain("\\bibliography{references}");
    expect(mainTex).not.toContain("\\input{sections/references}");
    expect(existsSync(path.join(bundleAbs, "nature.cls"))).toBe(true);
  });
});
