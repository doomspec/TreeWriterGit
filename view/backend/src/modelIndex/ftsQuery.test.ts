import { describe, expect, it } from "vitest";

import { buildFtsMatch } from "./ftsQuery.js";

describe("buildFtsMatch", () => {
  it("builds prefix token queries", () => {
    expect(buildFtsMatch("viability")).toBe('"viability"*');
    expect(buildFtsMatch("cell viability")).toBe('"cell"* AND "viability"*');
  });

  it("strips fts special characters", () => {
    expect(buildFtsMatch('foo"bar')).toBe('"foobar"*');
  });
});
