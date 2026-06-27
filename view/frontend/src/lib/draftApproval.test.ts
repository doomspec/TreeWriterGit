import { describe, expect, it } from "vitest";

import { requiresDraftApproval } from "@/lib/draftApproval";

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
