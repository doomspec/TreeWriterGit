import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  importMainBibtex,
  integrityHash,
  markMainBibEntryVerified,
  previewMainBibEntryFromCrossref,
  readMainBibEntries,
  searchCrossrefCandidates,
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
});
