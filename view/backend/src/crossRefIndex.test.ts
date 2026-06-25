import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildFigureLabelIndex, buildPaperCrossRefIndex } from "./crossRefIndex.js";
import { listPaperFigures } from "./figures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tw-crossref-"));
});

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await rm(root, { recursive: true, force: true });
});

describe("crossRefIndex", () => {
  it("indexes figure_label and fig:{folder} aliases", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "figures/fig5"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/fig5/INDEX.md"),
      "---\nkind: figure\ntitle: Fig5\nfigure_label: fig:correction_analysis\nfigure_preview: chart.png\n---\n",
      "utf8",
    );

    const figures = await listPaperFigures(root, paperRel);
    const index = buildFigureLabelIndex(figures);

    expect(index.get("fig:correction_analysis")?.path).toBe(`${paperRel}/figures/fig5`);
    expect(index.get("fig:fig5")?.path).toBe(`${paperRel}/figures/fig5`);
  });

  it("buildPaperCrossRefIndex returns serializable figure and table maps", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "figures/fig1"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/fig1/INDEX.md"),
      "---\nkind: figure\ntitle: Fig1\nfigure_label: fig:fig1\n---\n",
      "utf8",
    );

    const index = await buildPaperCrossRefIndex(root, paperRel);
    expect(index.figureLabels["fig:fig1"]?.path).toBe(`${paperRel}/figures/fig1`);
    expect(index.tableLabels).toEqual({});
  });
});
