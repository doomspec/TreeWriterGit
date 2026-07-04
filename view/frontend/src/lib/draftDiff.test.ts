import { describe, expect, it } from "vitest";

import {
  diffLineOps,
  effectiveDiffBaseline,
  hasPendingApprovalDiff,
  pendingChangesRows,
  pendingLineHighlightRows,
  pendingLineHighlights,
} from "@/lib/draftDiff";

describe("effectiveDiffBaseline", () => {
  it("falls back to loaded content when there is no approval record (null)", () => {
    expect(effectiveDiffBaseline(null, "Loaded text.")).toBe("Loaded text.");
  });

  it("uses the approved baseline as-is when it is an empty string (explicitly approved empty)", () => {
    expect(effectiveDiffBaseline("", "Loaded text.")).toBe("");
  });

  it("uses the approved baseline when it has real content", () => {
    expect(effectiveDiffBaseline("Approved.", "Loaded text.")).toBe("Approved.");
  });
});

describe("draftDiff", () => {
  it("marks inserted and deleted lines", () => {
    const ops = diffLineOps("line one\nline two", "line one\nline three");
    expect(ops.map((op) => op.kind)).toEqual(["equal", "delete", "insert"]);
  });

  it("highlights pending lines in the current document", () => {
    expect(pendingLineHighlights("a\nb", "a\nc")).toEqual(["equal", "insert"]);
  });

  it("returns all equal when texts match", () => {
    expect(pendingLineHighlights("same", "same")).toEqual(["equal"]);
  });

  it("highlights only changed words within an edited line", () => {
    const rows = pendingLineHighlightRows(
      "The quick brown fox jumps over the lazy dog.",
      "The quick red fox jumps over the lazy dog.",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("inline");
    if (rows[0]?.kind !== "inline") return;
    expect(rows[0].segments.filter((segment) => segment.kind === "insert").map((segment) => segment.text.trim())).toEqual([
      "red",
    ]);
    expect(rows[0].segments.filter((segment) => segment.kind === "delete").map((segment) => segment.text.trim())).toEqual([
      "brown",
    ]);
  });

  it("highlights only an inserted word in a paragraph line", () => {
    const rows = pendingLineHighlightRows(
      "Hello world.",
      "Hello beautiful world.",
    );
    expect(rows[0]?.kind).toBe("inline");
    if (rows[0]?.kind !== "inline") return;
    expect(rows[0].segments.filter((segment) => segment.kind === "insert").map((segment) => segment.text.trim())).toEqual([
      "beautiful",
    ]);
  });

  it("uses loaded content as diff baseline when nothing is approved yet", () => {
    const approved = null;
    const loaded = "Line one\nLine two";
    const current = "Line one\nLine two!";
    const rows = pendingChangesRows(approved, loaded, current);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("inline");
  });

  it("hides session diff when current matches loaded and nothing is approved", () => {
    const text = "Full paragraph on disk.";
    expect(pendingChangesRows(null, text, text)).toEqual([]);
  });

  it("does not treat never-approved content as pending when unchanged on disk", () => {
    const text = "Full paragraph on disk.";
    expect(hasPendingApprovalDiff(null, text, text)).toBe(false);
  });

  it("treats never-approved content as pending when edited since load", () => {
    expect(hasPendingApprovalDiff(null, "Original", "Original edited")).toBe(true);
  });

  it("treats empty never-approved content as not pending", () => {
    expect(hasPendingApprovalDiff(null, "", "")).toBe(false);
  });

  it("treats an explicitly-approved empty baseline as a real baseline, not a missing one", () => {
    // Regression test: approving a unit while its content is still empty must
    // NOT be indistinguishable from "never approved" — otherwise any later
    // edit silently fails to show as pending (the reported missing-highlight bug).
    expect(hasPendingApprovalDiff("", "", "Real content now.")).toBe(true);
  });

  it("does not treat highlight-only edits as pending approval", () => {
    const baseline = "Onboarding documentation shipped.";
    const highlighted = "Onboarding \\hl{yellow}{documentation} shipped.";
    expect(hasPendingApprovalDiff(baseline, baseline, highlighted)).toBe(false);
  });

  it("detects pending edits against approved baseline", () => {
    expect(hasPendingApprovalDiff("Alpha", "Alpha beta", "Alpha beta")).toBe(true);
    expect(hasPendingApprovalDiff("Alpha", "Alpha beta", "Alpha beta gamma")).toBe(true);
  });

  it("shows fully removed lines as delete rows until approved", () => {
    const rows = pendingLineHighlightRows("Line one\nLine two", "Line one");
    expect(rows.map((row) => row.kind)).toEqual(["equal", "delete"]);
    if (rows[1]?.kind === "delete") {
      expect(rows[1].text).toBe("Line two");
    }
  });

  it("includes deleted words in pending change rows", () => {
    const rows = pendingChangesRows(
      "The quick brown fox.",
      "The quick brown fox.",
      "The quick red fox.",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("inline");
    if (rows[0]?.kind !== "inline") return;
    expect(rows[0].segments.some((segment) => segment.kind === "delete" && segment.text.trim() === "brown")).toBe(true);
    expect(rows[0].segments.some((segment) => segment.kind === "insert" && segment.text.trim() === "red")).toBe(true);
  });

  it("highlights trailing word insertions after punctuation", () => {
    const rows = pendingLineHighlightRows("Para B.", "Para B edited.");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("inline");
    if (rows[0]?.kind !== "inline") return;
    expect(rows[0].segments.some((segment) => segment.kind === "insert" && segment.text.trim() === "edited.")).toBe(
      true,
    );
    expect(rows[0].segments.some((segment) => segment.kind === "insert" && segment.text.trim() === "B edited.")).toBe(
      false,
    );
  });
});
