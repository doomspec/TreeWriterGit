import { describe, expect, it } from "vitest";

import { diffLineOps, pendingLineHighlightRows, pendingLineHighlights } from "@/lib/draftDiff";

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
});
