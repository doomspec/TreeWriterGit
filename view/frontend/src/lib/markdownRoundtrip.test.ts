import { describe, expect, it } from "vitest";

import { editableHtmlToMarkdown, markdownToEditableHtml } from "./markdownRoundtrip";

describe("markdownRoundtrip", () => {
  it("roundtrips outline headings and bullet lists", () => {
    const source = `## Summary

- Use an hourglass structure
- Do not include references

## Outline

- Broad context: viable cell density
- Pivot: here we present VibeCount`;

    const html = markdownToEditableHtml(source);
    expect(html).toContain("<h2");
    expect(html).toContain("<li>");

    const restored = editableHtmlToMarkdown(html);
    expect(restored).toContain("## Summary");
    expect(restored).toContain("- Use an hourglass structure");
    expect(restored).toContain("## Outline");
    expect(restored).toContain("VibeCount");
  });

  it("roundtrips inline author notes", () => {
    const source = "Text \\iy{suggestion} here.";
    const html = markdownToEditableHtml(source);
    const restored = editableHtmlToMarkdown(html);
    expect(restored).toContain("\\iy{suggestion}");
  });
});
