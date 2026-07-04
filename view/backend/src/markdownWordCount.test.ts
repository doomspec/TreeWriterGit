import { describe, expect, it } from "vitest";

import { countMarkdownWords, markdownStats } from "@treewriter/shared";

describe("shared markdown word count", () => {
  it("counts words and characters", () => {
    expect(countMarkdownWords("  hello   world  ")).toBe(2);
    expect(markdownStats("  hello   world  ").words).toBe(2);
    expect(markdownStats("  hello   world  ").characters).toBeGreaterThan(0);
  });

  it("returns zero for empty input", () => {
    expect(countMarkdownWords("   ")).toBe(0);
    expect(markdownStats("\n")).toEqual({ words: 0, characters: 0 });
  });
});
