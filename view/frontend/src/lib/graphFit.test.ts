import { describe, expect, it } from "vitest";

import { computeFitTransform } from "./graphFit";

describe("computeFitTransform", () => {
  it("centers and scales content into the viewport", () => {
    const bounds = { x: 100, y: 50, width: 200, height: 100 } as DOMRect;
    const transform = computeFitTransform(bounds, 400, 300);
    expect(transform).not.toBeNull();
    expect(transform!.k).toBeGreaterThan(0);
  });

  it("returns null for empty bounds", () => {
    const bounds = { x: 0, y: 0, width: 0, height: 0 } as DOMRect;
    expect(computeFitTransform(bounds, 400, 300)).toBeNull();
  });
});
