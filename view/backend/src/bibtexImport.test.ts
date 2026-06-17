import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  importBibtexReferences,
  literatureNoteFromBibEntry,
  parseBibtex,
} from "./bibtexImport.js";

const SAMPLE_BIB = `
@article{smith2024,
  title={A Great Paper},
  author={Smith, Jane and Doe, John},
  year={2024},
  journal={Nature},
  doi={10.1038/example},
  abstract={This paper shows important results.}
}

@inproceedings{lee2023,
  title = "Conference Talk",
  author = "Lee, Amy",
  booktitle = {Proceedings of Example},
  year = 2023
}
`;

describe("parseBibtex", () => {
  it("parses common entry fields", () => {
    const entries = parseBibtex(SAMPLE_BIB);
    expect(entries).toHaveLength(2);
    expect(entries[0].citeKey).toBe("smith2024");
    expect(entries[0].fields.title).toBe("A Great Paper");
    expect(entries[0].fields.author).toContain("Smith");
    expect(entries[1].fields.booktitle).toBe("Proceedings of Example");
  });
});

describe("literatureNoteFromBibEntry", () => {
  it("builds literature note frontmatter and summary", () => {
    const [entry] = parseBibtex(SAMPLE_BIB);
    const note = literatureNoteFromBibEntry(entry);
    expect(note).toContain("cite_key: smith2024");
    expect(note).toContain("A Great Paper");
    expect(note).toContain("This paper shows important results.");
  });
});

describe("importBibtexReferences", () => {
  it("creates literature notes from a .bib file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "tw-bib-"));
    const paperRel = "papers/demo";
    await importBibtexReferences(root, paperRel, SAMPLE_BIB);

    const smith = await readFile(
      path.join(root, paperRel, "notes/literature/smith2024.md"),
      "utf8",
    );
    expect(smith).toContain("A Great Paper");

    const second = await importBibtexReferences(root, paperRel, SAMPLE_BIB);
    expect(second.created).toHaveLength(0);
    expect(second.skipped).toHaveLength(2);
  });
});
