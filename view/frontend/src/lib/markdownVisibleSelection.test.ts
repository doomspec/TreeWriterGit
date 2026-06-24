import { describe, expect, it } from "vitest";

import { buildMarkdownVisibleOffsetMap } from "./markdownVisibleSelection";

describe("buildMarkdownVisibleOffsetMap", () => {
  it("maps ref badges to visible ref+key text", () => {
    const map = buildMarkdownVisibleOffsetMap("See Fig. \\ref{fig:system}A for details.");
    expect(map.visibleText).toBe("See Fig. reffig:systemA for details.");
  });

  it("maps highlight macros to inner text only", () => {
    const map = buildMarkdownVisibleOffsetMap("Read \\hl{yellow}{this part} carefully.");
    expect(map.visibleText).toBe("Read this part carefully.");
  });

  it("strips markdown emphasis markers from visible text", () => {
    const map = buildMarkdownVisibleOffsetMap("This is **bold** text.");
    expect(map.visibleText).toBe("This is bold text.");
  });

  it("maps muL quantities to unicode", () => {
    const map = buildMarkdownVisibleOffsetMap("Add 0.1~\\mu\\text{L} sample.");
    expect(map.visibleText).toBe("Add 0.1µL sample.");
  });

  it("maps visible indices to markdown offsets inside highlight macros", () => {
    const markdown = "The pipeline \\hl{yellow}{first rotates} the image.";
    const map = buildMarkdownVisibleOffsetMap(markdown);
    const startVisible = map.visibleText.indexOf("first rotates");
    expect(startVisible).toBe(13);
    expect(map.startToMarkdown[startVisible]).toBe(25);
    expect(map.endToMarkdown[startVisible + "first rotates".length - 1]).toBe(38);
  });
});
