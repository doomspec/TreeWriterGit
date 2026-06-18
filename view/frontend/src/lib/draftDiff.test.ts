import { describe, expect, it } from "vitest";

import { diffLineOps, pendingLineHighlights } from "@/lib/draftDiff";

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
});
