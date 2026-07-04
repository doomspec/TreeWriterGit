/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";

import {
  buildLineStartIndex,
  entryToBibtex,
  findBibEntryCharRange,
  findBibEntryStartLine,
  normalizedOffsetToRaw,
  scrollTextareaToOffset,
} from "@/lib/bibEntrySource";
import type { BibLibraryEntry } from "@/lib/paperAssets";

const sampleEntry: BibLibraryEntry = {
  citeKey: "smith2024",
  type: "article",
  fields: { title: "A Paper", year: "2024" },
  verifiedStatus: "unverified",
  integrity: null,
};

const sampleBib = `@article{smith2024,
  title = {A Paper},
  year = {2024},
}

@book{doe2023,
  title = {Another},
}`;

const spacedBib = `@Article { jones2025 ,
  title = {Spaced Key},
}`;

describe("bibEntrySource", () => {
  it("serializes an entry to BibTeX", () => {
    expect(entryToBibtex(sampleEntry)).toContain("@article{smith2024,");
    expect(entryToBibtex(sampleEntry)).toContain("title = {A Paper}");
  });

  it("finds cite key line and character range in main.bib content", () => {
    expect(findBibEntryStartLine(sampleBib, "smith2024")).toBe(1);
    expect(findBibEntryStartLine(sampleBib, "doe2023")).toBe(6);
    expect(findBibEntryStartLine(sampleBib, "missing")).toBeNull();

    const range = findBibEntryCharRange(sampleBib, "smith2024");
    expect(range).not.toBeNull();
    expect(sampleBib.slice(range!.start, range!.end)).toContain("@article{smith2024,");
    expect(sampleBib.slice(range!.start, range!.end)).not.toContain("@book{doe2023");
  });

  it("finds entries with whitespace around type braces and cite keys", () => {
    const range = findBibEntryCharRange(spacedBib, "jones2025");
    expect(range).not.toBeNull();
    expect(spacedBib.slice(range!.start, range!.end)).toContain("jones2025");
  });

  it("maps normalized offsets back to CRLF raw strings", () => {
    const raw = "@article{one,\r\n  title = {A},\r\n}\r\n@article{two,\r\n  title = {B},\r\n}";
    const normalized = raw.replace(/\r\n/g, "\n");
    const range = findBibEntryCharRange(normalized, "two");
    expect(range).not.toBeNull();
    expect(raw.slice(normalizedOffsetToRaw(raw, range!.start))).toMatch(/^@article\{two,/);
  });

  it("scrolls using a line-start index without building a mirror DOM", () => {
    const textarea = document.createElement("textarea");
    textarea.value = sampleBib;
    Object.defineProperty(textarea, "clientHeight", { value: 200, configurable: true });
    textarea.style.lineHeight = "24px";
    document.body.appendChild(textarea);

    const lineStarts = buildLineStartIndex(sampleBib);
    const range = findBibEntryCharRange(sampleBib, "doe2023");
    expect(range).not.toBeNull();

    scrollTextareaToOffset(textarea, range!.start, lineStarts, { margin: 0 });
    expect(textarea.selectionStart).toBe(range!.start);
    expect(textarea.scrollTop).toBeGreaterThan(0);

    textarea.remove();
  });
});
