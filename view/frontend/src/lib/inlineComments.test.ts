import { describe, expect, it } from "vitest";

import { stripInlineComments } from "./inlineComments";

describe("inlineComments", () => {
  it("strips comment tags from markdown", () => {
    const markdown = "Line <comment id=\"1\" author=\"iy\">fix</comment> end";
    expect(stripInlineComments(markdown)).toBe("Line  end");
  });
});
