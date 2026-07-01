import { describe, expect, it } from "vitest";

import {
  listInlineComments,
  renderInlineCommentTag,
  stripInlineComments,
} from "./inlineComments.js";

describe("inlineComments", () => {
  it("parses and strips comment tags", () => {
    const markdown = "Hello <comment id=\"abc\" author=\"iy\">fix tense</comment> world";
    const comments = listInlineComments(markdown);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      id: "abc",
      author: "iy",
      text: "fix tense",
      resolved: false,
      line: 1,
    });
    expect(stripInlineComments(markdown)).toBe("Hello  world");
  });

  it("renders comment tags with attributes", () => {
    expect(
      renderInlineCommentTag({
        id: "abc",
        author: "iy",
        text: "note",
        resolved: true,
      }),
    ).toBe('<comment id="abc" author="iy" resolved="true">note</comment>');
  });
});
