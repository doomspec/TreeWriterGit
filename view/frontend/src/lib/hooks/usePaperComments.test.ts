/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { usePaperComments } from "@/lib/hooks/usePaperComments";

vi.mock("@/lib/api/commentsApi", () => ({
  fetchCommentSummary: vi.fn().mockResolvedValue({
    unresolved: 2,
    total: 3,
    assigned: 1,
    assignedUnresolved: 1,
  }),
  fetchAssignedComments: vi.fn().mockResolvedValue({
    comments: [
      {
        id: "c1",
        file: "papers/ml/intro/draft.md",
        line: 1,
        author: "Alice",
        text: "note",
        resolved: false,
        created_at: "2025-01-01T00:00:00Z",
        assigned_to: { type: "human", id: "bob", label: "Bob" },
      },
    ],
  }),
}));

describe("usePaperComments", () => {
  it("loads summary and assigned comments for a paper", async () => {
    const tree = [
      {
        name: "papers",
        path: "papers",
        type: "directory" as const,
        children: [
          {
            name: "ml",
            path: "papers/ml",
            type: "directory" as const,
            children: [
              {
                name: "intro",
                path: "papers/ml/intro",
                type: "directory" as const,
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const { result, rerender } = renderHook(
      ({ refreshVersion }) =>
        usePaperComments({
          paperSlug: "ml",
          paperPath: "papers/ml",
          tree,
          refreshVersion,
        }),
      { initialProps: { refreshVersion: 0 } },
    );

    await waitFor(() => {
      expect(result.current.commentSummary?.unresolved).toBe(2);
    });
    expect(result.current.assignedComments).toHaveLength(1);
    expect(result.current.assignedCountsByFolder.get("papers/ml/intro")).toBe(1);

    rerender({ refreshVersion: 1 });
    await waitFor(() => {
      expect(result.current.commentSummary?.unresolved).toBe(2);
    });
  });

  it("clears data when paper slug is null", async () => {
    const { result } = renderHook(() =>
      usePaperComments({
        paperSlug: null,
        paperPath: null,
        tree: [],
        refreshVersion: 0,
      }),
    );

    await waitFor(() => {
      expect(result.current.commentSummary).toBeNull();
    });
    expect(result.current.assignedComments).toEqual([]);
    expect(result.current.assignedCountsByFolder.size).toBe(0);
  });
});
