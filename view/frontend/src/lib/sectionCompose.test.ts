import { describe, expect, it } from "vitest";

import { normalizeComposedDraftBody, normalizeComposedSectionDraft } from "@/lib/sectionCompose";

describe("normalizeComposedSectionDraft", () => {
  it("strips the section title before normalizing", () => {
    const body = normalizeComposedSectionDraft(
      "Methods",
      "# Methods\n\nShared protocol text.\n",
    );
    expect(body).toBe("Shared protocol text.");
  });
});

describe("normalizeComposedDraftBody", () => {
  it("removes duplicate preamble before a linked child block", () => {
    const prose = "Accurate estimation of viable cell density (VCD).";
    const body = normalizeComposedDraftBody(
      `${prose}

## [Background](background/INDEX.md)

${prose}`,
      "Introduction",
    );
    expect(body).toBe(prose);
  });

  it("flattens a single linked child block to plain prose", () => {
    const prose = "Only paragraph in this section.";
    const body = normalizeComposedDraftBody(
      `## [Background](background/INDEX.md)

${prose}`,
      "Introduction",
    );
    expect(body).toBe(prose);
  });
});
