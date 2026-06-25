import { describe, expect, it, vi } from "vitest";

import type { CommentRecord } from "@treewriter/shared";

vi.mock("@/lib/userIdentity", () => ({
  getGitHubHandle: vi.fn(() => "alice"),
  getUserName: vi.fn(() => "Alice"),
}));

import {
  buildAssigneeOptions,
  commentAssignedToCurrentUser,
  currentUserAssigneeIds,
  matchesCommentFilter,
} from "@/lib/commentAssignees";

function comment(overrides: Partial<CommentRecord> = {}): CommentRecord {
  return {
    id: "c1",
    file: "papers/ml/intro/draft.md",
    line: 1,
    author: "Bob",
    text: "note",
    resolved: false,
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("currentUserAssigneeIds", () => {
  it("includes normalized github handle and display name", () => {
    expect(currentUserAssigneeIds()).toEqual(["alice"]);
  });
});

describe("commentAssignedToCurrentUser", () => {
  it("matches assignee id case-insensitively", () => {
    expect(
      commentAssignedToCurrentUser(
        comment({ assigned_to: { type: "human", id: "Alice", label: "Alice" } }),
      ),
    ).toBe(true);
    expect(
      commentAssignedToCurrentUser(
        comment({ assigned_to: { type: "human", id: "bob", label: "Bob" } }),
      ),
    ).toBe(false);
  });

  it("does not match label when id differs", () => {
    expect(
      commentAssignedToCurrentUser(
        comment({ assigned_to: { type: "human", id: "other", label: "Alice" } }),
      ),
    ).toBe(false);
  });
});

describe("matchesCommentFilter", () => {
  it("filters by assignment state", () => {
    const mine = comment({ assigned_to: { type: "human", id: "alice", label: "@alice" } });
    const ai = comment({ assigned_to: { type: "ai", id: "claude", label: "claude" } });
    const open = comment();

    expect(matchesCommentFilter(mine, "all")).toBe(true);
    expect(matchesCommentFilter(mine, "mine")).toBe(true);
    expect(matchesCommentFilter(ai, "ai")).toBe(true);
    expect(matchesCommentFilter(open, "unassigned")).toBe(true);
    expect(matchesCommentFilter(mine, "unassigned")).toBe(false);
    expect(matchesCommentFilter(ai, "mine")).toBe(false);
  });
});

describe("buildAssigneeOptions", () => {
  it("merges current user, providers, authors, and assignees", () => {
    const options = buildAssigneeOptions(
      [
        comment({ author: "Carol", assigned_to: { type: "human", id: "carol", label: "Carol" } }),
      ],
      [{ name: "claude" }],
    );

    const keys = options.map((option) => option.key);
    expect(keys).toContain("human:alice");
    expect(keys).toContain("ai:claude");
    expect(keys).toContain("human:Carol");
    expect(keys).toContain("human:carol");
    expect(options.find((option) => option.key === "human:alice")?.label).toBe("@alice");
  });
});
