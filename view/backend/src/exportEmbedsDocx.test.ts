import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DOCX_ASSET_URL_PREFIX,
  expandManuscriptEmbedsForDocx,
  replaceFigureRefsForDocx,
} from "./exportEmbedsDocx.js";
import { figureLabel } from "./exportEmbeds.js";
import { listPaperFigures } from "./figures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tw-docx-embed-"));
});

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await rm(root, { recursive: true, force: true });
});

describe("expandManuscriptEmbedsForDocx", () => {
  it("expands figure wikilinks to labels and block embeds to asset images", async () => {
    await mkdir(path.join(root, "papers/demo/figures/fig1"), { recursive: true });
    await writeFile(
      path.join(root, "papers/demo/figures/fig1/INDEX.md"),
      "---\nkind: figure\ntitle: Fig 1\nfigure_preview: chart.png\n---\n",
      "utf8",
    );
    await writeFile(path.join(root, "papers/demo/figures/fig1/draft.md"), "Caption text.", "utf8");
    await writeFile(path.join(root, "papers/demo/figures/fig1/chart.png"), "fakepng", "utf8");

    const source =
      "Pipeline ([[papers/demo/figures/fig1|Fig. 1]]).\n\n::figure[papers/demo/figures/fig1]";
    const { markdown, assets } = await expandManuscriptEmbedsForDocx(
      root,
      "papers/demo",
      source,
    );

    expect(markdown).toContain("Fig. 1");
    expect(markdown).toContain(`${DOCX_ASSET_URL_PREFIX}papers/demo/figures/fig1/chart.png`);
    expect(assets).toContain("papers/demo/figures/fig1/chart.png");
  });

  it("resolves LaTeX figure refs and appends a Figures section with PNG assets", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "figures"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/INDEX.md"),
      "---\nkind: section\nchild_order:\n  - fig5\n  - fig3\n---\n",
      "utf8",
    );
    await mkdir(path.join(root, paperRel, "figures/fig5"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/fig5/INDEX.md"),
      "---\nkind: figure\ntitle: Fig5\nfigure_label: fig:correction_analysis\nfigure_preview: fig_correction_analysis.png\nfigure_source: fig_correction_analysis.png\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "figures/fig5/draft.md"),
      "**Fig5.** Correction analysis caption.",
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "figures/fig5/fig_correction_analysis.png"),
      "fakepng",
      "utf8",
    );
    await mkdir(path.join(root, paperRel, "figures/fig3"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/fig3/INDEX.md"),
      "---\nkind: figure\ntitle: Fig3\nfigure_label: fig:benchmark\nfigure_preview: fig3_detection-performance.pdf\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(root, paperRel, "figures/fig3/draft.md"),
      "**Fig3.** Detection benchmark caption.",
      "utf8",
    );

    const source =
      "Correction rate (Fig. \\ref{fig:correction_analysis}B) and benchmark (Fig. \\ref{fig:benchmark}C).";
    const { markdown, assets } = await expandManuscriptEmbedsForDocx(root, paperRel, source);

    expect(markdown).toContain("Fig. 5B");
    expect(markdown).toContain("Fig. 3C");
    expect(markdown).toContain("## Figures");
    expect(markdown).toContain("### Figure 5");
    expect(markdown).toContain(`${DOCX_ASSET_URL_PREFIX}${paperRel}/figures/fig5/fig_correction_analysis.png`);
    expect(markdown).toContain("### Figure 3");
    expect(assets).toContain(`${paperRel}/figures/fig5/fig_correction_analysis.png`);
  });
});

describe("replaceFigureRefsForDocx", () => {
  it("maps label aliases to display numbers", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "figures/fig5"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/fig5/INDEX.md"),
      "---\nkind: figure\ntitle: Fig5\nfigure_label: fig:correction_analysis\nfigure_source: fig_correction_analysis.png\n---\n",
      "utf8",
    );
    const figures = await listPaperFigures(root, paperRel);
    const index = new Map<string, (typeof figures)[0]>();
    for (const meta of figures) {
      const label = figureLabel(meta);
      if (label) index.set(label, meta);
      index.set("fig:correction_analysis", meta);
    }
    const numberByPath = new Map([[figures[0]!.path, "5"]]);

    const output = replaceFigureRefsForDocx(
      "See Fig. \\ref{fig:correction_analysis}B.",
      index,
      numberByPath,
    );
    expect(output).toBe("See Fig. 5B.");
  });
});
