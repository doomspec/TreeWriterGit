import { describe, expect, it } from "vitest";

import {
  applyPendingMarksToMarkdown,
  alignBaselineBlocksToCurrent,
  blockMarkdownWithPendingHighlights,
  markdownWithPendingHighlights,
} from "@/lib/pendingHighlightMarkdown";

describe("pendingHighlightMarkdown", () => {
  it("wraps deleted words in del tags", () => {
    const result = applyPendingMarksToMarkdown(
      "The quick brown fox.",
      "The quick red fox.",
    );
    expect(result).toContain('<del class="highlight-inline--deleted">brown</del>');
    expect(result).toContain('<mark class="highlight-inline--pending">red</mark>');
  });

  it("keeps removed lines visible until approved", () => {
    const result = applyPendingMarksToMarkdown("Line one\nLine two", "Line one");
    expect(result).toContain('<del class="highlight-inline--deleted">Line two</del>');
  });

  it("wraps inserted words in mark tags", () => {
    const result = applyPendingMarksToMarkdown(
      "The quick brown fox.",
      "The quick red fox.",
    );
    expect(result).toContain('<mark class="highlight-inline--pending">red</mark>');
    expect(result).toContain("The quick ");
  });

  it("wraps wholly new lines", () => {
    const result = applyPendingMarksToMarkdown("Line one", "Line one\nLine two");
    expect(result).toContain('<mark class="highlight-inline--pending">Line two</mark>');
  });

  it("returns null when texts match", () => {
    expect(applyPendingMarksToMarkdown("same", "same")).toBeNull();
  });

  it("uses loaded content when nothing is approved yet", () => {
    const result = markdownWithPendingHighlights("", "Hello world.", "Hello beautiful world.");
    expect(result).toMatch(/highlight-inline--pending">beautiful\s*<\/mark>/);
  });

  it("highlights only changed words when block index shifts", () => {
    const approved = "Block one.\n\nBlock two unchanged.\n\nBlock three.";
    const current = "Block one edited.\n\nBlock two unchanged.\n\nBlock three.";
    const result = blockMarkdownWithPendingHighlights(approved, approved, 1, "Block two unchanged.");
    expect(result).toBeNull();
  });

  it("aligns baseline blocks by content not only index", () => {
    const approved = "Para A.\n\nPara B.";
    const currentBlocks = [{ id: "b1", markdown: "Para B edited." }];
    const aligned = alignBaselineBlocksToCurrent(approved, currentBlocks);
    expect(aligned.get("b1")).toBe("Para B.");
    const highlighted = applyPendingMarksToMarkdown(aligned.get("b1") ?? "", "Para B edited.");
    expect(highlighted).toMatch(/highlight-inline--pending">\s*edited/);
    expect(highlighted).not.toMatch(/highlight-inline--pending">Para B/);
  });
});
