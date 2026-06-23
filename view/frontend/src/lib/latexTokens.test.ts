import { describe, expect, it } from "vitest";

import {
  enhanceLatexTokenBadges,
  encodeLabelToken,
  parseLabelCodeSpan,
  parseRefCodeSpan,
  preprocessLatexTokensForMarkdown,
  restoreLatexTokensFromMarkdown,
} from "@/lib/latexTokens";
import { markdownToEditableHtml, editableHtmlToMarkdown } from "@/lib/markdownRoundtrip";
import { preprocessInlineNotesForMarkdown } from "@/lib/inlineNotes";

describe("latexTokens", () => {
  it("encodes labels before inline notes run", () => {
    const input = "Intro \\label{sec:expert_concordance}";
    expect(preprocessInlineNotesForMarkdown(preprocessLatexTokensForMarkdown(input))).toBe(
      `Intro ${encodeLabelToken("sec:expert_concordance")}`,
    );
  });

  it("parses encoded label spans", () => {
    expect(parseLabelCodeSpan("§label:sec:expert_concordance§")).toBe("sec:expert_concordance");
  });

  it("parses encoded ref spans", () => {
    expect(parseRefCodeSpan("§ref:fig:benchmark§")).toBe("fig:benchmark");
  });

  it("renders label badges in editable html", () => {
    const html = markdownToEditableHtml("\\label{sec:results}");
    expect(html).toContain('class="latex-label-badge"');
    expect(html).toContain("sec:results");
    expect(html).not.toContain("inline-note-badge");
  });

  it("roundtrips label badges back to latex", () => {
    const html = markdownToEditableHtml("Section \\label{sec:foo}.");
    expect(editableHtmlToMarkdown(html)).toContain("\\label{sec:foo}");
  });

  it("restores encoded tokens from markdown", () => {
    expect(restoreLatexTokensFromMarkdown(encodeLabelToken("sec:foo"))).toBe("\\label{sec:foo}");
  });

  it("enhances token code spans to badges", () => {
    const html = enhanceLatexTokenBadges("<code>§label:sec:foo§</code>");
    expect(html).toContain("latex-label-badge__key");
    expect(html).toContain("sec:foo");
  });
});
