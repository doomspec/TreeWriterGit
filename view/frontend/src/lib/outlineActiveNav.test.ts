import { describe, expect, it } from "vitest";

import type { MarkdownHeading } from "@/lib/markdownOutline";
import { findActiveOutlineHeadingId, isOutlineNavLinkActive } from "@/lib/outlineActiveNav";

const headings: MarkdownHeading[] = [
  {
    id: "outline-link-intro",
    level: 2,
    text: "Introduction",
    lineIndex: 4,
    href: "introduction/INDEX.md",
  },
  {
    id: "outline-link-methods",
    level: 2,
    text: "Methods",
    lineIndex: 5,
    href: "methods/INDEX.md",
  },
  {
    id: "outline-link-stats",
    level: 3,
    text: "Statistics",
    lineIndex: 6,
    href: "methods/statistics/INDEX.md",
  },
];

describe("findActiveOutlineHeadingId", () => {
  it("returns the deepest matching section for the current path", () => {
    expect(
      findActiveOutlineHeadingId(
        headings,
        "papers/demo",
        "papers/demo/methods/statistics",
      ),
    ).toBe("outline-link-stats");
  });

  it("returns null at the outline container root", () => {
    expect(findActiveOutlineHeadingId(headings, "papers/demo", "papers/demo")).toBeNull();
  });
});

describe("isOutlineNavLinkActive", () => {
  it("matches section folder paths", () => {
    expect(
      isOutlineNavLinkActive(
        "papers/demo",
        "introduction/INDEX.md",
        "papers/demo/introduction/subsection",
      ),
    ).toBe(true);
    expect(
      isOutlineNavLinkActive(
        "papers/demo",
        "methods/INDEX.md",
        "papers/demo/introduction",
      ),
    ).toBe(false);
  });
});
