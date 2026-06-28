import { describe, expect, it } from "vitest";

import { requiresDraftApproval, resolvePendingApprovalDisplay } from "@/lib/draftApproval";

describe("requiresDraftApproval", () => {
  it("returns false for temp-notes paths", () => {
    expect(requiresDraftApproval("papers/demo/intro/temp-notes.md")).toBe(false);
    expect(requiresDraftApproval("sections/foo/temp-notes.md")).toBe(false);
  });

  it("returns true for draft and outline paths", () => {
    expect(requiresDraftApproval("papers/demo/intro/draft.md")).toBe(true);
    expect(requiresDraftApproval("papers/demo/intro/outline.md")).toBe(true);
  });
});

describe("resolvePendingApprovalDisplay", () => {
  it("does not substitute the viewer handle for external pending edits", () => {
    expect(
      resolvePendingApprovalDisplay({
        editMeta: { editedBy: "yakavetsiv", aiAssisted: true, aiProvider: "Gemini CLI" },
        pendingSource: "ai",
        githubHandle: "yakavetsiv",
        isDirty: false,
      }),
    ).toEqual({
      editedBy: "yakavetsiv",
      pendingSource: "ai",
      aiAssisted: true,
      aiProvider: "Gemini CLI",
    });
  });

  it("uses the viewer handle only for in-session human edits", () => {
    expect(
      resolvePendingApprovalDisplay({
        editMeta: { editedBy: null, aiAssisted: false, aiProvider: null },
        pendingSource: "human",
        githubHandle: "yakavetsiv",
        isDirty: true,
      }).editedBy,
    ).toBe("yakavetsiv");
  });

  it("shows AI provider without forcing the logged-in user", () => {
    expect(
      resolvePendingApprovalDisplay({
        editMeta: { editedBy: null, aiAssisted: true, aiProvider: "Gemini CLI" },
        pendingSource: null,
        githubHandle: "yakavetsiv",
        isDirty: false,
      }),
    ).toMatchObject({
      editedBy: null,
      pendingSource: "ai",
      aiAssisted: true,
      aiProvider: "Gemini CLI",
    });
  });
});
