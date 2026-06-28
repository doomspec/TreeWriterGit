import { describe, expect, it } from "vitest";

import { summarizeManuscriptChanges } from "./changeSummary.js";

describe("summarizeManuscriptChanges", () => {
  it("counts added and removed lines", () => {
    const summary = summarizeManuscriptChanges("line one\nline two\n", "line one\nline three\n");
    expect(summary.addedLines).toBe(1);
    expect(summary.removedLines).toBe(1);
    expect(summary.changedWords).toBeGreaterThan(0);
  });

  it("returns zeros for identical text", () => {
    const text = "same\ncontent\n";
    expect(summarizeManuscriptChanges(text, text)).toEqual({
      addedLines: 0,
      removedLines: 0,
      changedWords: 0,
    });
  });
});
