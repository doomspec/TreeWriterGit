import { describe, expect, it } from "vitest";

import { validateBibEntryFields, validateCiteKey } from "@/lib/bibtexValidate";

describe("validateBibEntryFields", () => {
  it("flags missing title/author/year", () => {
    const warnings = validateBibEntryFields("article", {});
    expect(warnings).toContain("Missing title.");
    expect(warnings).toContain("Missing author (or editor).");
    expect(warnings).toContain("Missing year.");
  });

  it("passes a complete article entry", () => {
    const warnings = validateBibEntryFields("article", {
      title: "T",
      author: "A",
      year: "2020",
      journal: "J",
    });
    expect(warnings).toEqual([]);
  });

  it("flags a malformed year", () => {
    const warnings = validateBibEntryFields("article", {
      title: "T",
      author: "A",
      year: "not-a-year",
      journal: "J",
    });
    expect(warnings.some((w) => w.includes("year"))).toBe(true);
  });

  it("flags a missing venue field for the entry type", () => {
    const warnings = validateBibEntryFields("article", { title: "T", author: "A", year: "2020" });
    expect(warnings.some((w) => w.includes("journal"))).toBe(true);
  });

  it("accepts an editor in place of an author", () => {
    const warnings = validateBibEntryFields("book", {
      title: "T",
      editor: "E",
      year: "2020",
      publisher: "P",
    });
    expect(warnings.some((w) => w.includes("author"))).toBe(false);
  });
});

describe("validateCiteKey", () => {
  it("flags empty and whitespace-containing keys", () => {
    expect(validateCiteKey("")).not.toEqual([]);
    expect(validateCiteKey("a b")).not.toEqual([]);
  });

  it("accepts a normal key", () => {
    expect(validateCiteKey("smith2020")).toEqual([]);
  });
});
