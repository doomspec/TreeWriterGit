import { describe, expect, it } from "vitest";

import {
  editorCommentLines,
  fileLineToEditorLine,
  unresolvedCommentFileLines,
} from "./commentLineHighlight";
import type { CommentRecord } from "@treewriter/shared";

function comment(line: number, resolved = false): CommentRecord {
  return {
    id: String(line),
    file: "papers/demo/unit/draft.md",
    line,
    author: "A",
    text: "note",
    resolved,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("commentLineHighlight", () => {
  it("collects unresolved comment file lines", () => {
    expect(
      [...unresolvedCommentFileLines([comment(2), comment(3, true), comment(5)])].sort(),
    ).toEqual([2, 5]);
  });

  it("maps file lines onto preview body lines", () => {
    const full = "---\ntitle: x\n---\n\n# Title\n\nBody line";
    const body = "Body line";
    const fileLines = unresolvedCommentFileLines([comment(7)]);
    expect([...editorCommentLines(fileLines, full, body)]).toEqual([1]);
    expect(fileLineToEditorLine(7, full, body)).toBe(1);
  });

  it("uses file lines directly when editor shows full content", () => {
    const full = "line one\nline two";
    const fileLines = unresolvedCommentFileLines([comment(2)]);
    expect([...editorCommentLines(fileLines, full, full)]).toEqual([2]);
  });
});
