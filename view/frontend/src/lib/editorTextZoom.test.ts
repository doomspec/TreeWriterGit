import { describe, expect, it } from "vitest";

import {
  clampEditorTextZoom,
  formatEditorTextZoom,
  stepEditorTextZoom,
} from "./editorTextZoom";

describe("editorTextZoom", () => {
  it("clamps zoom to allowed range", () => {
    expect(clampEditorTextZoom(0.5)).toBe(0.85);
    expect(clampEditorTextZoom(2)).toBe(1.5);
  });

  it("steps zoom in and out", () => {
    expect(stepEditorTextZoom(1, "in")).toBe(1.05);
    expect(stepEditorTextZoom(1, "out")).toBe(0.95);
  });

  it("formats zoom as percentage", () => {
    expect(formatEditorTextZoom(1.15)).toBe("115%");
  });
});
