import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findOrphanCrossRefs, validatePaperCrossRefs } from "./crossRefValidation.js";
import { buildFigureLabelIndex } from "./crossRefIndex.js";
import { listPaperFigures } from "./figures.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tw-crossref-val-"));
});

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await rm(root, { recursive: true, force: true });
});

describe("crossRefValidation", () => {
  it("flags orphan figure and table refs", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "figures/fig5"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/fig5/INDEX.md"),
      "---\nkind: figure\ntitle: Fig5\nfigure_label: fig:correction_analysis\n---\n",
      "utf8",
    );

    const figures = await listPaperFigures(root, paperRel);
    const figureIndex = buildFigureLabelIndex(figures);
    const markdown =
      "Known (Fig. \\ref{fig:correction_analysis}B) and orphan (Fig. \\ref{fig:missing}A, Table \\ref{tab:ghost}).";

    expect(findOrphanCrossRefs(markdown, figureIndex, new Map())).toEqual([
      "fig:missing",
      "tab:ghost",
    ]);
  });

  it("validatePaperCrossRefs scans combined manuscript", async () => {
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "figures/fig5"), { recursive: true });
    await writeFile(
      path.join(root, paperRel, "figures/fig5/INDEX.md"),
      "---\nkind: figure\ntitle: Fig5\nfigure_label: fig:correction_analysis\n---\n",
      "utf8",
    );

    const { orphanCrossRefs } = await validatePaperCrossRefs(
      root,
      paperRel,
      "See \\ref{fig:correction_analysis} and \\ref{fig:unknown}.",
    );
    expect(orphanCrossRefs).toEqual(["fig:unknown"]);
  });
});
