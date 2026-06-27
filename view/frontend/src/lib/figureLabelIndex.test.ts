import { describe, expect, it } from "vitest";

import type { FigureMetadata } from "@/lib/figures";
import {
  computeScopedRefFigurePlacementsByBlockIndex,
  extractFigureRefKeys,
  figureLabelIndexFromCrossRef,
  resolveFigureByRefKey,
  resolveReferencedFigures,
} from "@/lib/figureLabelIndex";

function figure(overrides: Partial<FigureMetadata> & Pick<FigureMetadata, "path">): FigureMetadata {
  return {
    kind: "figure-unit",
    title: "Figure",
    caption: "",
    summary: null,
    previewPath: null,
    sourcePath: null,
    outlinePath: null,
    draftPath: null,
    figureLabel: null,
    ...overrides,
  };
}

describe("figureLabelIndex", () => {
  it("maps figure_label keys from cross-ref index", () => {
    const correction = figure({
      path: "papers/vibecount/figures/fig5",
      figureLabel: "fig:correction_analysis",
    });
    const benchmark = figure({
      path: "papers/vibecount/figures/fig3",
      figureLabel: "fig:benchmark",
    });
    const index = figureLabelIndexFromCrossRef({
      figureLabels: {
        "fig:correction_analysis": correction,
        "fig:fig5": correction,
        "fig:benchmark": benchmark,
        "fig:fig3": benchmark,
      },
      tableLabels: {},
    });

    expect(resolveFigureByRefKey("fig:correction_analysis", index)?.path).toBe(correction.path);
    expect(resolveFigureByRefKey("fig:benchmark", index)?.path).toBe(benchmark.path);
  });

  it("resolves referenced figures in citation order", () => {
    const correction = figure({
      path: "papers/vibecount/figures/fig5",
      figureLabel: "fig:correction_analysis",
    });
    const benchmark = figure({
      path: "papers/vibecount/figures/fig3",
      figureLabel: "fig:benchmark",
    });
    const index = figureLabelIndexFromCrossRef({
      figureLabels: {
        "fig:correction_analysis": correction,
        "fig:benchmark": benchmark,
      },
      tableLabels: {},
    });
    const markdown =
      "Rate (Fig. \\ref{fig:correction_analysis}B) and benchmark (Fig. \\ref{fig:benchmark}C).";
    expect(extractFigureRefKeys(markdown)).toEqual(["fig:correction_analysis", "fig:benchmark"]);
    expect(resolveReferencedFigures(markdown, index).map((item) => item.path)).toEqual([
      correction.path,
      benchmark.path,
    ]);
  });

  it("dedupes repeated refs within one scope and repeats across scopes", () => {
    const correction = figure({
      path: "papers/vibecount/figures/fig5",
      figureLabel: "fig:correction_analysis",
    });
    const index = figureLabelIndexFromCrossRef({
      figureLabels: { "fig:correction_analysis": correction },
      tableLabels: {},
    });
    const markdown = [
      "## [Unit A](unit-a/INDEX.md)",
      "",
      "First (Fig. \\ref{fig:correction_analysis}B).",
      "",
      "Again (Fig. \\ref{fig:correction_analysis}C).",
      "",
      "## [Unit B](unit-b/INDEX.md)",
      "",
      "Other unit (Fig. \\ref{fig:correction_analysis}B).",
    ].join("\n");
    const placements = computeScopedRefFigurePlacementsByBlockIndex(markdown, index);
    expect([...placements.keys()]).toEqual([1, 4]);
    expect(placements.get(1)?.map((item) => item.path)).toEqual([correction.path]);
    expect(placements.get(4)?.map((item) => item.path)).toEqual([correction.path]);
  });

  it("places multiple unique figures after the first mentioning paragraph", () => {
    const correction = figure({
      path: "papers/vibecount/figures/fig5",
      figureLabel: "fig:correction_analysis",
    });
    const benchmark = figure({
      path: "papers/vibecount/figures/fig3",
      figureLabel: "fig:benchmark",
    });
    const index = figureLabelIndexFromCrossRef({
      figureLabels: {
        "fig:correction_analysis": correction,
        "fig:benchmark": benchmark,
      },
      tableLabels: {},
    });
    const markdown =
      "Rate (Fig. \\ref{fig:correction_analysis}B) and benchmark (Fig. \\ref{fig:benchmark}C).";
    const placements = computeScopedRefFigurePlacementsByBlockIndex(markdown, index);
    expect(placements.get(0)?.map((item) => item.path)).toEqual([correction.path, benchmark.path]);
  });
});
