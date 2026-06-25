import { describe, expect, it } from "vitest";

import { sortCommentsByLine } from "@/lib/sortCommentsByLine";

describe("sortCommentsByLine", () => {
  it("sorts by line then created_at", () => {
    const sorted = sortCommentsByLine([
      { line: 3, created_at: "2025-01-02T00:00:00Z" },
      { line: 1, created_at: "2025-01-03T00:00:00Z" },
      { line: 1, created_at: "2025-01-01T00:00:00Z" },
    ]);

    expect(sorted.map((item) => [item.line, item.created_at])).toEqual([
      [1, "2025-01-01T00:00:00Z"],
      [1, "2025-01-03T00:00:00Z"],
      [3, "2025-01-02T00:00:00Z"],
    ]);
  });
});
