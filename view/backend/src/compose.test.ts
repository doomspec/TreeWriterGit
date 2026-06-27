import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import { composeSectionView, displayChildTitle, parseOutlineSummary } from "./compose.js";

let root: string;

async function writeSection(
  rel: string,
  frontmatter: Record<string, unknown>,
  outlineBody = "",
  draftBody = "",
): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(abs, { recursive: true });
  await writeFile(
    path.join(abs, "INDEX.md"),
    matter.stringify(`# ${rel}\n`, frontmatter),
    "utf8",
  );
  if (outlineBody) {
    await writeFile(path.join(abs, "outline.md"), outlineBody, "utf8");
  }
  if (draftBody) {
    await writeFile(path.join(abs, "draft.md"), draftBody, "utf8");
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "twg-compose-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("displayChildTitle", () => {
  it("uses titleCase when INDEX title is a lowercase slug", () => {
    expect(displayChildTitle("background", "background")).toBe("Background");
    expect(displayChildTitle("problem statement", "problem-statement")).toBe("Problem Statement");
  });

  it("keeps a distinct INDEX title", () => {
    expect(displayChildTitle("Our Novel Method", "methods")).toBe("Our Novel Method");
  });
});

describe("parseOutlineSummary", () => {
  it("reads ## Summary section", () => {
    const md = `# Title\n\n## Summary\n\nHello summary.\n\n## Outline\n`;
    expect(parseOutlineSummary(md)).toBe("Hello summary.");
  });

  it("reads first paragraph after H1 when ## Summary is absent", () => {
    const md =
      "# Background\n\nMotivate lab automation: cell culture is tedious.\n";
    expect(parseOutlineSummary(md)).toBe(
      "Motivate lab automation: cell culture is tedious.",
    );
  });
});

describe("composeSectionView", () => {
  it("composes subsection summaries and stitched drafts", async () => {
    await writeSection(
      "introduction",
      { kind: "section", title: "Introduction", child_order: ["background", "claims"] },
      `# Introduction\n\n## Summary\n\nMotivation here.\n`,
    );
    await writeSection(
      "introduction/background",
      { kind: "unit", title: "Background" },
      `# Background\n\n## Summary\n\nPrior work summary.\n`,
      "# Background\n\nPrior work draft prose.\n",
    );
    await writeSection(
      "introduction/claims",
      { kind: "unit", title: "Claims" },
      `# Claims\n\n## Summary\n\nOur claims summary.\n`,
      "# Claims\n\nClaims draft prose.\n",
    );

    const view = await composeSectionView(root, "introduction");
    expect(view.title).toBe("Introduction");
    expect(view.children).toHaveLength(2);
    expect(view.outlineMarkdown).toContain("### [Background](background/INDEX.md)");
    expect(view.outlineMarkdown).not.toContain("[Open Background →]");
    expect(view.outlineMarkdown).toContain("Prior work summary.");
    expect(view.draftMarkdown).toContain("## [Background](background/INDEX.md)");
    expect(view.draftMarkdown).not.toContain("[Open Background →]");
    expect(view.draftMarkdown).toContain("Prior work draft prose.");
    expect(view.draftMarkdown).toContain("Claims draft prose.");
  });

  it("titleCases lowercase slug INDEX titles in outline", async () => {
    await writeSection("section", { kind: "section", child_order: ["background"] });
    await writeSection("section/background", { kind: "unit", title: "background" });

    const view = await composeSectionView(root, "section");
    expect(view.outlineMarkdown).toContain("### [Background](background/INDEX.md)");
    expect(view.children[0]?.title).toBe("Background");
  });

  it("includes a leaf section's own draft when it has no children", async () => {
    const prose =
      "Routine cell culture depends on counting viable cell density (VCD), the live cells per millilitre.";
    await writeSection(
      "papers/demo/abstract",
      { kind: "section", title: "Abstract", child_order: [] },
      `# Abstract\n\n## Summary\n\nHourglass abstract structure.\n`,
      `${prose}\n`,
    );

    const view = await composeSectionView(root, "papers/demo/abstract");
    expect(view.children).toHaveLength(0);
    expect(view.draftMarkdown).toContain(prose);
    expect(view.draftMarkdown).not.toContain("Hourglass abstract structure.");
  });

  it("does not duplicate single unit draft in section compose", async () => {
    await writeSection("intro", { kind: "section", title: "Introduction", child_order: ["background"] });
    const prose =
      "Accurate estimation of viable cell density (VCD), determined by the product of total cell concentration and viability.";
    await writeSection(
      "intro/background",
      { kind: "unit", title: "Background" },
      `# Background\n\nOverview bullets.\n`,
      `${prose}\n`,
    );

    const view = await composeSectionView(root, "intro");
    const body = view.draftMarkdown.replace(/^#\s+.+\n+/, "");
    expect(body.match(/Accurate estimation/g)?.length ?? 0).toBe(1);
    expect(body).not.toContain("## [Background]");
    expect(body.trim()).toBe(prose);
  });

  it("composes paper draft from ordered sections and skips asset folders", async () => {
    await writeSection(
      "papers/demo",
      {
        kind: "paper",
        title: "Demo Paper",
        section_order: ["introduction", "results"],
      },
      `# Demo Paper\n\n## Summary\n\nPaper summary text.\n`,
    );
    await writeSection(
      "papers/demo/introduction",
      { kind: "section", child_order: ["background"] },
      `# Introduction\n\n## Summary\n\nIntro summary.\n`,
    );
    await writeSection(
      "papers/demo/introduction/background",
      { kind: "unit", title: "Background" },
      `# Background\n\n## Summary\n\nBg summary.\n`,
      "# Background\n\nBackground prose.\n",
    );
    await writeSection(
      "papers/demo/results",
      { kind: "section", child_order: ["main"] },
    );
    await writeSection(
      "papers/demo/results/main",
      { kind: "unit", title: "Main Result" },
      `# Main\n\n## Summary\n\nResult summary.\n`,
      "# Main Result\n\nResult prose.\n",
    );
    await mkdir(path.join(root, "papers/demo/figures"), { recursive: true });
    await writeSection("papers/demo/figures/fig1", { kind: "figure", title: "Figure 1" });
    await mkdir(path.join(root, "papers/demo/equations"), { recursive: true });
    await writeSection("papers/demo/equations/eq1", {
      kind: "equation",
      title: "Equation 1",
      equation_source: "source.tex",
    });

    const view = await composeSectionView(root, "papers/demo");
    expect(view.title).toBe("Demo Paper");
    expect(view.outlineMarkdown).toContain("## Sections");
    expect(view.draftMarkdown).toContain("Paper summary text.");
    expect(view.draftMarkdown).toContain("## [Introduction](introduction/INDEX.md)");
    expect(view.draftMarkdown).toContain("Background prose.");
    expect(view.draftMarkdown).toContain("## [Results](results/INDEX.md)");
    expect(view.draftMarkdown).toContain("Result prose.");
    expect(view.draftMarkdown).not.toContain("figures");
    expect(view.draftMarkdown).not.toContain("equations");
    expect(view.children.map((c) => c.name)).toEqual(["introduction", "results"]);
  });
});
