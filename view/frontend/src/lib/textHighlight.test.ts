import { describe, expect, it } from "vitest";

import { isInlineAuthorNoteMacro } from "./inlineNotes";
import {
  applyTextHighlight,
  enhanceTextHighlightBadges,
  hasTextHighlightMacros,
  isPendingTrackChangeHtml,
  parseTextHighlightCodeSpan,
  preprocessTextHighlightsForMarkdown,
  replaceTextHighlightMacrosInHtml,
  restoreTextHighlightsFromMarkdown,
  wrapTextHighlight,
} from "./textHighlight";
import { editableHtmlToMarkdown, markdownToEditableHtml, renderBlockDisplayHtml } from "./markdownRoundtrip";

describe("textHighlight", () => {
  it("does not collide with inline author notes", () => {
    expect(isInlineAuthorNoteMacro("hl")).toBe(false);
  });

  it("wraps selection in highlight macro", () => {
    expect(wrapTextHighlight("yellow", "important")).toBe("\\hl{yellow}{important}");
  });

  it("encodes highlights for markdown preview", () => {
    const input = "Read \\hl{yellow}{this part} carefully.";
    expect(preprocessTextHighlightsForMarkdown(input)).toBe("Read `⟦hl:yellow:this part⟧` carefully.");
  });

  it("parses encoded highlight spans", () => {
    expect(parseTextHighlightCodeSpan("⟦hl:blue:key term⟧")).toEqual({
      color: "blue",
      text: "key term",
    });
  });

  it("restores highlight macros after html roundtrip", () => {
    const input = "Text `⟦hl:green:claim⟧` here.";
    expect(restoreTextHighlightsFromMarkdown(input)).toBe("Text \\hl{green}{claim} here.");
  });

  it("applies highlight to a selection", () => {
    const input = "Alpha beta gamma";
    const result = applyTextHighlight(input, 6, 10, "pink");
    expect(result.value).toBe("Alpha \\hl{pink}{beta} gamma");
    expect(result.selectionStart).toBe(16);
    expect(result.selectionEnd).toBe(20);
  });

  it("unwraps a fully selected highlight macro", () => {
    const input = "Alpha \\hl{yellow}{beta} gamma";
    const result = applyTextHighlight(input, 6, 23, "yellow");
    expect(result.value).toBe("Alpha beta gamma");
    expect(result.selectionStart).toBe(6);
    expect(result.selectionEnd).toBe(10);
  });
});

describe("textHighlight html badges", () => {
  it("renders colored marks in editable html", () => {
    const html = markdownToEditableHtml("Read \\hl{yellow}{this part} carefully.");
    expect(html).toContain('class="text-highlight-badge text-highlight-yellow"');
    expect(html).toContain("this part");
    expect(html).not.toContain("<code>⟦hl:");
  });

  it("roundtrips highlight badges back to latex macros", () => {
    const html = markdownToEditableHtml("Read \\hl{blue}{term} here.");
    expect(editableHtmlToMarkdown(html)).toContain("\\hl{blue}{term}");
  });

  it("enhances encoded highlight code spans to marks", () => {
    const html = enhanceTextHighlightBadges("<code>⟦hl:yellow:important⟧</code>");
    expect(html).toContain("text-highlight-yellow");
    expect(html).toContain("important");
  });

  it("detects highlight macros", () => {
    expect(hasTextHighlightMacros("\\hl{yellow}{term}")).toBe(true);
    expect(hasTextHighlightMacros("plain text")).toBe(false);
  });

  it("renders highlight macros inside pending track-change html", () => {
    const pendingHtml =
      'Structure this <mark class="highlight-inline--pending">section\\hl{yellow}{se}</mark> as one claim';
    expect(isPendingTrackChangeHtml(pendingHtml)).toBe(true);
    const html = replaceTextHighlightMacrosInHtml(pendingHtml);
    expect(html).toContain('class="text-highlight-badge text-highlight-yellow"');
    expect(html).not.toContain("\\hl{yellow}");
  });

  it("renders highlights through block display html helper", () => {
    const html = renderBlockDisplayHtml("Read \\hl{yellow}{this} now.");
    expect(html).toContain("text-highlight-yellow");
    expect(html).toContain("this");
  });
});
