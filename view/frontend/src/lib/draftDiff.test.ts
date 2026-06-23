import { describe, expect, it } from "vitest";

import { diffLineOps, hasPendingApprovalDiff, pendingChangesRows, pendingLineHighlightRows, pendingLineHighlights } from "@/lib/draftDiff";

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
    const approved = "";
    const loaded = "Line one\nLine two";
    const current = "Line one\nLine two!";
    const rows = pendingChangesRows(approved, loaded, current);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("inline");
  });

  it("hides session diff when current matches loaded and nothing is approved", () => {
    const text = "Full paragraph on disk.";
    expect(pendingChangesRows("", text, text)).toEqual([]);
  });

  it("treats unchanged loaded content as not pending when nothing is approved yet", () => {
    const text = "Full paragraph on disk.";
    expect(hasPendingApprovalDiff("", text, text)).toBe(false);
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
