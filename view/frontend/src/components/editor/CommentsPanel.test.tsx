/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { CommentsPanel } from "@/components/editor/CommentsPanel";
import { fetchComments } from "@/modelApi";

vi.mock("@/modelApi", () => ({
  fetchComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/lib/commentAssignees", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/commentAssignees")>();
  return {
    ...actual,
    loadAiProviderNames: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/userIdentity", () => ({
  getCommentAuthor: vi.fn(() => ""),
  getGitHubHandle: vi.fn(() => ""),
  getUserName: vi.fn(() => "Tester"),
  hasCommentAuthorIdentity: vi.fn(() => true),
  setUserName: vi.fn(),
}));

describe("CommentsPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchComments).mockResolvedValue({
      comments: [
        {
          id: "c1",
          file: "papers/ml/sections/intro/draft.md",
          line: 2,
          author: "Alice",
          text: "Tighten opening",
          resolved: false,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    });
  });

  it("loads and renders comments", async () => {
    render(
      <CommentsPanel filePath="papers/ml/sections/intro/draft.md" refreshVersion={0} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Tighten opening")).toBeTruthy();
    });
    expect(screen.getByTitle("Alice")).toBeTruthy();
    expect(screen.getByText("Comments")).toBeTruthy();
    expect(fetchComments).toHaveBeenCalledWith("papers/ml/sections/intro/draft.md");
  });
});
