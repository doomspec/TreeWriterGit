import { describe, expect, it } from "vitest";

import { filterBibLibraryEntries } from "@/lib/bibEntrySearch";
import type { BibLibraryEntry } from "@/lib/paperAssets";

const sample: BibLibraryEntry[] = [
  {
    type: "article",
    citeKey: "smith2024",
    fields: { title: "A Great Paper", author: "Smith, Jane", year: "2024" },
    verifiedStatus: "verified",
    integrity: "abc",
  },
  {
    type: "article",
    citeKey: "jones2023",
    fields: { title: "Another Study", author: "Jones", year: "2023" },
    verifiedStatus: "unverified",
    integrity: null,
  },
];

describe("bibEntrySearch", () => {
  it("filters by query and verification status", () => {
    expect(filterBibLibraryEntries(sample, "great")).toHaveLength(1);
    expect(filterBibLibraryEntries(sample, "", "unverified")).toHaveLength(1);
    expect(filterBibLibraryEntries(sample, "smith", "verified")).toHaveLength(1);
  });
});
