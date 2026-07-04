import { describe, expect, it } from "vitest";

import { paperSlugFromModelPath, resolveActivePaperSlug } from "@/lib/activePaperSlug";

describe("activePaperSlug", () => {
  it("extracts slug from nested model paths", () => {
    expect(paperSlugFromModelPath("papers/demo/abstract/unit-a/draft.md")).toBe("demo");
    expect(paperSlugFromModelPath("papers/demo")).toBe("demo");
  });

  it("prefers the current browse slug over last paper path", () => {
    expect(resolveActivePaperSlug("other", "papers/demo")).toBe("other");
  });

  it("falls back to last paper path when browse slug is missing", () => {
    expect(resolveActivePaperSlug(null, "papers/demo")).toBe("demo");
    expect(resolveActivePaperSlug(null, null)).toBeNull();
  });
});
