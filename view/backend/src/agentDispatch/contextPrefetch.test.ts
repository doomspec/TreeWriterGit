import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildDispatchContextCliBlock,
  extractSearchTerms,
  gatherSiblingUnitOutlines,
} from "./contextPrefetch.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("extractSearchTerms", () => {
  it("returns frequent meaningful words from outline text", () => {
    const terms = extractSearchTerms(
      "Cell viability assays measure metabolic activity. Viability remains central to interpretation.",
    );
    expect(terms).toContain("viability");
    expect(terms.length).toBeLessThanOrEqual(3);
  });

  it("filters short words and stopwords", () => {
    const terms = extractSearchTerms("This is about the methods and results from our study.");
    expect(terms).not.toContain("about");
    expect(terms).not.toContain("from");
  });
});

describe("buildDispatchContextCliBlock", () => {
  it("includes tw-context commands when script exists", () => {
    const block = buildDispatchContextCliBlock(repoRoot);
    expect(block).toContain("tw-context.mjs");
    expect(block).toContain("search");
  });
});

describe("gatherSiblingUnitOutlines", () => {
  it("is exported for integration tests via readDispatchUnitContext", () => {
    expect(typeof gatherSiblingUnitOutlines).toBe("function");
  });
});
