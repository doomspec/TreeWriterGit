import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteMainBibEntries,
  getMainBibEntry,
  getMainBibSummary,
  importMainBibtex,
  integrityHash,
  markMainBibEntryVerified,
  previewMainBibEntryFromCrossref,
  readMainBibEntries,
  searchCrossrefCandidates,
  searchMainBibReferences,
  updateMainBibEntry,
  updateMainBibEntryFromCrossref,
} from "./bibLibrary.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "tw-main-bib-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const SAMPLE_BIB = `
@article{smith2024,
  title={A Great Paper},
  author={Smith, Jane and Doe, John},
  year={2024},
  journal={Nature},
  doi={10.1038/example}
}
`;

describe("main.bib library", () => {
  it("imports entries into model/main.bib and skips duplicates", async () => {
    const first = await importMainBibtex(root, SAMPLE_BIB);
    expect(first.created).toEqual(["smith2024"]);
    const second = await importMainBibtex(root, SAMPLE_BIB);
    expect(second.skipped).toEqual(["smith2024"]);

    const raw = await readFile(path.join(root, "main.bib"), "utf8");
    expect(raw).toContain("@article{smith2024");
    expect(raw).toContain("title = {A Great Paper}");
  });

  it("marks entries verified with a hash that becomes stale after edits", async () => {
    await importMainBibtex(root, SAMPLE_BIB);
    const verified = await markMainBibEntryVerified(root, "smith2024");
    expect(verified.verifiedStatus).toBe("verified");
    expect(verified.fields.integrity).toBe(integrityHash(verified));

    const edited = await updateMainBibEntry(root, "smith2024", {
      fields: { ...verified.fields, title: "Changed Paper" },
    });
    expect(edited.verifiedStatus).toBe("stale");
  });

  it("merges partial field patches without dropping existing metadata", async () => {
    await importMainBibtex(root, SAMPLE_BIB);
    const edited = await updateMainBibEntry(root, "smith2024", {
      fields: { title: "Retitled Paper" },
    });
    expect(edited.fields.title).toBe("Retitled Paper");
    expect(edited.fields.author).toBe("Smith, Jane and Doe, John");
    expect(edited.fields.year).toBe("2024");
  });

  it("deletes one or more entries from main.bib", async () => {
    await importMainBibtex(
      root,
      `${SAMPLE_BIB}
@article{jones2020,
  title={Another Paper},
  author={Jones, Pat},
  year={2020}
}`,
    );
    const result = await deleteMainBibEntries(root, ["smith2024", "missing-key"]);
    expect(result.deleted).toEqual(["smith2024"]);
    expect(result.missing).toEqual(["missing-key"]);

    const remaining = await readMainBibEntries(root);
    expect(remaining.map((entry) => entry.citeKey)).toEqual(["jones2020"]);
  });

  it("searches Crossref by DOI", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      expect(url).toContain("/works/10.1000%2Ffresh");
      return new Response(
        JSON.stringify({
          message: {
            DOI: "10.1000/fresh",
            title: ["A Great Paper"],
            author: [{ given: "Jane", family: "Smith" }],
            issued: { "date-parts": [[2025]] },
            "container-title": ["Science"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const candidates = await searchCrossrefCandidates("https://doi.org/10.1000/fresh");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      doi: "10.1000/fresh",
      title: "A Great Paper",
      similarity: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("searches Crossref candidates and updates an entry from returned BibTeX", async () => {
    await importMainBibtex(root, SAMPLE_BIB);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/transform/application")) {
        return new Response(
          "@article{crossref-key, title={A Great Paper}, author={Smith, Jane}, year={2025}, journal={Science}, doi={10.1000/fresh}}",
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          message: {
            items: [
              {
                DOI: "10.1000/fresh",
                title: ["A Great Paper"],
                author: [{ given: "Jane", family: "Smith" }],
                issued: { "date-parts": [[2025]] },
                "container-title": ["Science"],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const candidates = await searchCrossrefCandidates("A Great Paper");
    expect(candidates[0]).toMatchObject({ doi: "10.1000/fresh", title: "A Great Paper" });

    const preview = await previewMainBibEntryFromCrossref(root, "smith2024", "10.1000/fresh");
    expect(preview.citeKey).toBe("smith2024");
    expect(preview.fields.year).toBe("2025");
    expect(preview.verifiedStatus).toBe("verified");
    expect((await readMainBibEntries(root))[0].fields.year).toBe("2024");

    const updated = await updateMainBibEntryFromCrossref(root, "smith2024", "10.1000/fresh");
    expect(updated.citeKey).toBe("smith2024");
    expect(updated.fields.year).toBe("2025");
    expect(updated.verifiedStatus).toBe("verified");
    expect(fetchMock).toHaveBeenCalled();

    const [stored] = await readMainBibEntries(root);
    expect(stored.verifiedStatus).toBe("verified");
  });

  it("returns summary, search, and single-entry lookups", async () => {
    await importMainBibtex(root, SAMPLE_BIB);
    const summary = await getMainBibSummary(root);
    expect(summary.total).toBe(1);
    expect(summary.unverified).toBe(1);

    const search = await searchMainBibReferences(root, { q: "great", limit: 10 });
    expect(search.total).toBe(1);
    expect(search.entries[0]?.citeKey).toBe("smith2024");

    const cachedSearch = await searchMainBibReferences(root, { q: "great", limit: 10 });
    expect(cachedSearch.entries[0]?.citeKey).toBe("smith2024");

    const entry = await getMainBibEntry(root, "smith2024");
    expect(entry.fields.title).toBe("A Great Paper");
    expect(entry.sourceRange).toMatchObject({ start: expect.any(Number), end: expect.any(Number) });
    const raw = await readFile(path.join(root, "main.bib"), "utf8");
    expect(raw.slice(entry.sourceRange!.start, entry.sourceRange!.end)).toContain("@article{smith2024");

    await expect(getMainBibEntry(root, "missing-key")).rejects.toThrow(/not found/i);
  });

  it("uses cached references for empty browse queries without re-filtering", async () => {
    await importMainBibtex(
      root,
      `
@article{alpha2024, title={Alpha}, year={2024}}
@article{zeta2024, title={Zeta}, year={2024}}
`,
    );
    const browse = await searchMainBibReferences(root, { limit: 10 });
    expect(browse.total).toBe(2);
    expect(browse.entries.map((entry) => entry.citeKey)).toEqual(["alpha2024", "zeta2024"]);
  });
});
