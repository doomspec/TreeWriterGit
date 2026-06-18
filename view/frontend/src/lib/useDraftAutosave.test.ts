import { describe, expect, it } from "vitest";

import { resolvePendingSourceOnEdit } from "@/lib/useDraftAutosave";

describe("resolvePendingSourceOnEdit", () => {
  it("returns null when approval is not required", () => {
    expect(resolvePendingSourceOnEdit("ai", true, false)).toBeNull();
  });

  it("returns null when content matches approved baseline", () => {
    expect(resolvePendingSourceOnEdit("human", false, true)).toBeNull();
  });

  it("keeps ai source sticky while pending", () => {
    expect(resolvePendingSourceOnEdit("ai", true, true)).toBe("ai");
  });

  it("defaults to human for pending human edits", () => {
    expect(resolvePendingSourceOnEdit(null, true, true)).toBe("human");
    expect(resolvePendingSourceOnEdit("human", true, true)).toBe("human");
  });
});
