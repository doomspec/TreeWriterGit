import { describe, expect, it } from "vitest";

import { normalizeManuscriptTags, normalizeProjectSlug } from "./manuscriptTags.js";

describe("manuscriptTags", () => {
  it("normalizes tags to lowercase unique slugs", () => {
    expect(normalizeManuscriptTags(["NSF", "2026", "nsf"])).toEqual(["nsf", "2026"]);
  });

  it("parses comma-separated tag strings", () => {
    expect(normalizeManuscriptTags("nsf, 2026")).toEqual(["nsf", "2026"]);
  });

  it("rejects invalid tag characters", () => {
    expect(() => normalizeManuscriptTags(["bad tag!"])).toThrow(/Invalid tag/);
  });

  it("normalizes project slug", () => {
    expect(normalizeProjectSlug("RoboCulture")).toBe("roboculture");
    expect(normalizeProjectSlug("")).toBeNull();
  });
});
