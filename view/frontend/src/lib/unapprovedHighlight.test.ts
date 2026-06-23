import { describe, expect, it } from "vitest";

import { unapprovedSectionRowClass } from "@/lib/unapprovedHighlight";

describe("unapprovedSectionRowClass", () => {
  it("uses amber border on compact highlighted rows", () => {
    const classes = unapprovedSectionRowClass({
      highlight: true,
      pending: true,
      active: true,
      compact: true,
    });
    expect(classes).toContain("bg-amber-500/15");
    expect(classes).toContain("border-amber-500/35");
    expect(classes).toContain("ring-amber-500/55");
  });
});
