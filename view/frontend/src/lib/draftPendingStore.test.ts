import { describe, expect, it } from "vitest";

import { pendingChildApprovalPaths } from "./draftPendingStore";

describe("pendingChildApprovalPaths", () => {
  it("returns pending paths under child folders only", () => {
    const paths = new Set([
      "papers/demo/intro/draft.md",
      "papers/demo/intro/outline.md",
      "papers/demo/intro/u1/draft.md",
      "papers/demo/intro/u1/outline.md",
      "papers/demo/intro/sub/u2/draft.md",
      "papers/demo/other/u3/draft.md",
    ]);
    expect(pendingChildApprovalPaths("papers/demo/intro", paths).sort()).toEqual([
      "papers/demo/intro/sub/u2/draft.md",
      "papers/demo/intro/u1/draft.md",
      "papers/demo/intro/u1/outline.md",
    ]);
  });
});
