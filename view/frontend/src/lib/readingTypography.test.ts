import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clampReadingFontSizeScale,
  DEFAULT_READING_TYPOGRAPHY,
  loadReadingTypography,
  readingFontFamilyStack,
  saveReadingTypography,
} from "./readingTypography";

const STORAGE_KEY = "treewriter.readingTypography.v1";

describe("readingTypography", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads defaults when storage is empty", () => {
    expect(loadReadingTypography()).toEqual(DEFAULT_READING_TYPOGRAPHY);
  });

  it("persists and reloads settings", () => {
    saveReadingTypography({ fontFamily: "crimson", fontSizeScale: 1.15 });
    expect(loadReadingTypography()).toEqual({ fontFamily: "crimson", fontSizeScale: 1.15 });
  });

  it("clamps font size scale", () => {
    expect(clampReadingFontSizeScale(0.5)).toBe(0.85);
    expect(clampReadingFontSizeScale(2)).toBe(1.35);
    expect(clampReadingFontSizeScale(1.12)).toBe(1.12);
  });

  it("falls back for invalid stored family", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontFamily: "comic sans", fontSizeScale: 1 }));
    expect(loadReadingTypography().fontFamily).toBe("georgia");
  });

  it("returns stack for known families", () => {
    expect(readingFontFamilyStack("crimson")).toContain("Crimson Pro");
  });
});
