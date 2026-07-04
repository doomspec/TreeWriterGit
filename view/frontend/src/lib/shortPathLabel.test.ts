import { describe, expect, it } from "vitest";

import { paperHistoryScopeLabel, shortPathLabel } from "@/lib/shortPathLabel";

describe("shortPathLabel", () => {
  it("truncates paths deeper than two segments", () => {
    expect(shortPathLabel("papers/demo/1-intro/some-unit")).toBe("…/1-intro/some-unit");
  });

  it("returns short paths unchanged", () => {
    expect(shortPathLabel("papers/demo")).toBe("papers/demo");
  });
});

describe("paperHistoryScopeLabel", () => {
  it("shows slug and all-sections scope", () => {
    expect(paperHistoryScopeLabel("papers/dyi_bioprinting/1-introduction/unit-a")).toBe(
      "dyi_bioprinting · all sections",
    );
  });

  it("falls back when not under papers/", () => {
    expect(paperHistoryScopeLabel("notes/foo")).toBe("Paper history");
  });
});
