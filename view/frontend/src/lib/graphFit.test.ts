import { describe, expect, it } from "vitest";

import {
  computeFitTransform,
  computeNodeBounds,
  graphFitOptions,
  graphLabelText,
  graphNodeRadius,
} from "./graphFit";

describe("graphNodeRadius", () => {
  it("uses larger radius for focus nodes", () => {
    expect(graphNodeRadius({ links: 0, isFocus: true })).toBeGreaterThan(
      graphNodeRadius({ links: 0 }),
    );
  });

  it("grows with link count up to a cap", () => {
    expect(graphNodeRadius({ links: 10 })).toBe(graphNodeRadius({ links: 4 }));
  });
});

describe("graphLabelText", () => {
  it("keeps short labels unchanged", () => {
    expect(graphLabelText("Quick Start", true)).toBe("Quick Start");
  });

  it("truncates long labels in embedded sidebar", () => {
    const label = graphLabelText("Writing Workflow Overview", true);
    expect(label.length).toBeLessThanOrEqual(16);
    expect(label.endsWith("…")).toBe(true);
  });

  it("allows longer labels in full graph view", () => {
    expect(graphLabelText("Writing Workflow", false)).toBe("Writing Workflow");
  });

  it("truncates at the full-graph limit", () => {
    const label = graphLabelText("Writing Workflow Overview", false);
    expect(label.length).toBeLessThanOrEqual(22);
    expect(label.endsWith("…")).toBe(true);
  });
});

describe("graphFitOptions", () => {
  it("caps zoom in embedded sidebar", () => {
    expect(graphFitOptions(true, false).maxScale).toBe(1.6);
  });

  it("uses a higher cap in standalone graph view", () => {
    expect(graphFitOptions(false, false).maxScale).toBe(2.5);
  });
});

describe("computeFitTransform", () => {
  it("centers and scales content into the viewport", () => {
    const bounds = { x: 100, y: 50, width: 200, height: 100 };
    const transform = computeFitTransform(bounds, 400, 300);
    expect(transform).not.toBeNull();
    expect(transform!.k).toBeGreaterThan(0);
  });

  it("returns null for empty bounds", () => {
    const bounds = { x: 0, y: 0, width: 0, height: 0 };
    expect(computeFitTransform(bounds, 400, 300)).toBeNull();
  });

  it("respects maxScale for tight local graphs", () => {
    const bounds = { x: 180, y: 160, width: 40, height: 40 };
    const transform = computeFitTransform(bounds, 280, 400, { maxScale: 1.6 });
    expect(transform).not.toBeNull();
    expect(transform!.k).toBeLessThanOrEqual(1.6);
  });

  it("respects minScale", () => {
    const bounds = { x: 0, y: 0, width: 4000, height: 3000 };
    const transform = computeFitTransform(bounds, 400, 300, { minScale: 0.5 });
    expect(transform!.k).toBeGreaterThanOrEqual(0.5);
  });
});

describe("computeNodeBounds", () => {
  it("wraps node positions with radius margin", () => {
    const bounds = computeNodeBounds([
      { x: 100, y: 100, links: 0 },
      { x: 200, y: 150, links: 2, isFocus: true },
    ]);
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(90);
    expect(bounds!.height).toBeGreaterThan(40);
  });

  it("returns null when nodes lack coordinates", () => {
    expect(computeNodeBounds([{ links: 0 }])).toBeNull();
  });

  it("excludes label-sized padding from hover state", () => {
    const nodes = [
      { x: 140, y: 200, links: 1 },
      { x: 160, y: 210, links: 1 },
      { x: 150, y: 190, links: 1, isFocus: true },
    ];
    const bounds = computeNodeBounds(nodes)!;
    const transform = computeFitTransform(bounds, 280, 360, graphFitOptions(true, false));
    expect(transform!.k).toBeLessThanOrEqual(1.6);
  });
});
