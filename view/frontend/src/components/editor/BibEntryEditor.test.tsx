/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BibEntryEditor } from "@/components/editor/BibEntryEditor";
import type { BibLibraryEntry } from "@/lib/paperAssets";

vi.mock("@/lib/paperAssets", () => ({
  deleteBibEntries: vi.fn(),
  previewBibEntryFromCrossref: vi.fn(),
  saveBibEntry: vi.fn(),
  searchCrossrefForBibEntry: vi.fn(),
  updateBibEntryFromCrossref: vi.fn(),
  verifyBibEntry: vi.fn(),
}));
vi.mock("@/lib/bibLibraryStore", () => ({
  invalidateBibLibrary: vi.fn(),
  patchBibLibraryEntry: vi.fn(),
}));
vi.mock("@/lib/referenceSearchCache", () => ({
  invalidateReferenceSearchCache: vi.fn(),
}));

Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

const incompleteEntry: BibLibraryEntry = {
  type: "article",
  citeKey: "smith2020",
  fields: { title: "A Study" },
  verifiedStatus: "unverified",
  integrity: null,
};

const completeEntry: BibLibraryEntry = {
  type: "article",
  citeKey: "jones2019",
  fields: { title: "Another Paper", author: "Jones, A.", year: "2019", journal: "J. Things", integrity: "sha256:x" },
  verifiedStatus: "verified",
  integrity: "sha256:x",
};

describe("BibEntryEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows validation warnings for an incomplete entry", () => {
    const { getByText } = render(<BibEntryEditor entry={incompleteEntry} onError={vi.fn()} />);
    expect(getByText(/Missing author/)).toBeTruthy();
    expect(getByText(/Missing year/)).toBeTruthy();
    expect(getByText(/Missing journal/)).toBeTruthy();
  });

  it("shows no warnings for a complete entry", () => {
    const { queryByText } = render(<BibEntryEditor entry={completeEntry} onError={vi.fn()} />);
    expect(queryByText(/Missing/)).toBeNull();
  });

  it("toggles the raw BibTeX section and renders the serialized entry without integrity", () => {
    const { getByText, queryByText } = render(<BibEntryEditor entry={completeEntry} onError={vi.fn()} />);
    expect(queryByText(/@article\{jones2019/)).toBeNull();
    fireEvent.click(getByText("Raw BibTeX entry"));
    const pre = getByText(/@article\{jones2019/);
    expect(pre.textContent).toContain("author = {Jones, A.}");
    expect(pre.textContent).toContain("journal = {J. Things}");
    expect(pre.textContent).not.toContain("integrity");
  });

  it("copies the raw BibTeX to the clipboard", () => {
    const { getByText } = render(<BibEntryEditor entry={completeEntry} onError={vi.fn()} />);
    fireEvent.click(getByText("Raw BibTeX entry"));
    fireEvent.click(getByText("Copy"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("@article{jones2019"));
  });
});
