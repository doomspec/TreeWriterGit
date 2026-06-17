import { describe, expect, it } from "vitest";

import { assetContentType, isAllowedAssetPath } from "./figures.js";

describe("figures asset helpers", () => {
  it("allows supported asset extensions", () => {
    expect(isAllowedAssetPath("papers/x/preview.png")).toBe(true);
    expect(isAllowedAssetPath("papers/x/source.mmd")).toBe(true);
    expect(isAllowedAssetPath("papers/x/draft.md")).toBe(false);
  });

  it("maps content types", () => {
    expect(assetContentType("x.png")).toBe("image/png");
    expect(assetContentType("x.mmd")).toContain("text/plain");
  });
});
