import { describe, expect, it } from "vitest";

import type { PendingReviewItem } from "@treewriter/shared";

import {
  authorKeyForReview,
  groupPendingReviewsByAuthor,
  mergePendingReviews,
} from "@/lib/pendingReviews";

function review(partial: Partial<PendingReviewItem> & Pick<PendingReviewItem, "path">): PendingReviewItem {
  return {
    kind: "draft",
    unitPath: partial.path.replace(/\/draft\.md$/, ""),
    unitTitle: "Unit",
    sectionPath: null,
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    changeSummary: { addedLines: 1, removedLines: 0, changedWords: 1 },
    ...partial,
  };
}

describe("groupPendingReviewsByAuthor", () => {
  it("groups human and AI edits separately", () => {
    const items = [
      review({ path: "papers/demo/a/draft.md", editedBy: "octocat" }),
      review({
        path: "papers/demo/b/draft.md",
        aiAssisted: true,
        aiProvider: "Claude Code",
      }),
      review({ path: "papers/demo/c/draft.md", editedBy: "octocat" }),
    ];
    const groups = groupPendingReviewsByAuthor(items);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.authorKey === "octocat")?.items).toHaveLength(2);
    expect(groups.find((group) => group.authorKey === "Claude Code")?.items).toHaveLength(1);
  });
});

describe("authorKeyForReview", () => {
  it("uses AI provider when assisted", () => {
    expect(
      authorKeyForReview(
        review({ path: "x/draft.md", aiAssisted: true, aiProvider: "Codex" }),
      ),
    ).toBe("Codex");
  });
});

describe("mergePendingReviews", () => {
  it("adds editor-only pending paths as placeholders", () => {
    const merged = mergePendingReviews(
      [review({ path: "papers/demo/a/draft.md" })],
      ["papers/demo/b/draft.md"],
    );
    expect(merged.map((item) => item.path).sort()).toEqual(
      ["papers/demo/a/draft.md", "papers/demo/b/draft.md"].sort(),
    );
  });
});
