/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  buildMarkdownVisibleOffsetMap,
  pendingAwareDomVisibleText,
  resolveMarkdownSelectionRange,
} from "./markdownVisibleSelection";

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

describe("pendingAwareDomVisibleText", () => {
  it("omits deleted track-change spans", () => {
    const surface = document.createElement("div");
    surface.innerHTML =
      'Onboarding <del class="highlight-inline--deleted">documentation</del><mark class="highlight-inline--pending">documentation</mark> shipped.';
    expect(pendingAwareDomVisibleText(surface).replace(/\s+/g, " ").trim()).toBe(
      "Onboarding documentation shipped.",
    );
  });
});

describe("resolveMarkdownSelectionRange", () => {
  it("maps selection inside pending track-change html to markdown offsets", () => {
    const markdown = "Onboarding documentation shipped as a real paper.";
    const surface = document.createElement("div");
    surface.innerHTML =
      'Onboarding <del class="highlight-inline--deleted">documentation</del><mark class="highlight-inline--pending">documentation</mark> shipped as a real paper.';
    document.body.appendChild(surface);

    const textNode = surface.querySelector("mark")?.firstChild;
    expect(textNode).toBeTruthy();
    const range = document.createRange();
    range.setStart(textNode!, 0);
    range.setEnd(textNode!, "documentation".length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const resolved = resolveMarkdownSelectionRange(surface, markdown);
    expect(resolved).toEqual({
      start: markdown.indexOf("documentation"),
      end: markdown.indexOf("documentation") + "documentation".length,
    });

    selection?.removeAllRanges();
    document.body.removeChild(surface);
  });
});
