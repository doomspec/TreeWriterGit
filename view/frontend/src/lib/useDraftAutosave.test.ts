import { describe, expect, it } from "vitest";

import { resolvePendingSourceOnEdit, showSessionApprovalChrome } from "@/lib/useDraftAutosave";

describe("resolvePendingSourceOnEdit", () => {
  it("returns null when approval is not required", () => {
    expect(resolvePendingSourceOnEdit("ai", true, false, true)).toBeNull();
  });

  it("returns null when content matches approved baseline", () => {
    expect(resolvePendingSourceOnEdit("human", false, true, true)).toBeNull();
  });

  it("keeps ai source sticky while pending", () => {
    expect(resolvePendingSourceOnEdit("ai", true, true, false)).toBe("ai");
  });

  it("defaults to human only after a session edit", () => {
    expect(resolvePendingSourceOnEdit(null, true, true, false)).toBeNull();
    expect(resolvePendingSourceOnEdit(null, true, true, true)).toBe("human");
    expect(resolvePendingSourceOnEdit("human", true, true, false)).toBe("human");
  });

  it("infers ai from index metadata while pending", () => {
    expect(resolvePendingSourceOnEdit(null, true, true, false, { aiAssisted: true })).toBe("ai");
  });
});

describe("showSessionApprovalChrome", () => {
  it("shows chrome whenever content differs from the approved baseline", () => {
    expect(showSessionApprovalChrome(true, false, null)).toBe(true);
    expect(showSessionApprovalChrome(true, true, null)).toBe(true);
    expect(showSessionApprovalChrome(true, false, "human")).toBe(true);
    expect(showSessionApprovalChrome(true, false, "ai")).toBe(true);
  });

  it("hides chrome when content matches the approved baseline", () => {
    expect(showSessionApprovalChrome(false, true, "human")).toBe(false);
    expect(showSessionApprovalChrome(false, false, null)).toBe(false);
  });
});
