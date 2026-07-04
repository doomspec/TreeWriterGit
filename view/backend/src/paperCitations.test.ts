import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { importMainBibtex } from "./bibLibrary.js";
import { collectPaperCitedKeys, listPaperCitedReferences, removeCiteKeyFromPaperDrafts } from "./paperCitations.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "tw-paper-cites-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("paperCitations", () => {
  it("collects cite keys from unit drafts under a paper", async () => {
    const paperRel = "papers/demo";
    const unitRel = `${paperRel}/introduction/claim`;
    await mkdir(path.join(root, unitRel), { recursive: true });
    await writeFile(
      path.join(root, unitRel, "draft.md"),
      "Prior work [@smith2024; @jones2020] shows this.\n",
      "utf8",
    );

    expect(await collectPaperCitedKeys(root, paperRel)).toEqual(["jones2020", "smith2024"]);
  });

  it("returns cited references from main.bib and stubs for missing keys", async () => {
    const paperRel = "papers/demo";
    const unitRel = `${paperRel}/introduction/claim`;
    await mkdir(path.join(root, unitRel), { recursive: true });
    await writeFile(
      path.join(root, unitRel, "draft.md"),
      "See [@smith2024] and [@missing-key].\n",
      "utf8",
    );
    await importMainBibtex(
      root,
      `@article{smith2024, title={Known Paper}, author={Smith}, year={2024}}`,
    );

    const references = await listPaperCitedReferences(root, paperRel);
    expect(references.map((ref) => ref.citeKey)).toEqual(["missing-key", "smith2024"]);
    expect(references.find((ref) => ref.citeKey === "smith2024")?.title).toBe("Known Paper");
    expect(references.find((ref) => ref.citeKey === "missing-key")?.missingFromLibrary).toBe(true);
  });

  it("removes a cite key from all unit drafts under a paper", async () => {
    const paperRel = "papers/demo";
    const unitRel = `${paperRel}/introduction/claim`;
    await mkdir(path.join(root, unitRel), { recursive: true });
    await writeFile(
      path.join(root, unitRel, "draft.md"),
      "See [@smith2024] and [@missing-key]. Also @missing-key alone.\n",
      "utf8",
    );

    const result = await removeCiteKeyFromPaperDrafts(root, paperRel, "missing-key");
    expect(result.modified).toEqual([`${unitRel}/draft.md`]);

    const updated = await readFile(path.join(root, unitRel, "draft.md"), "utf8");
    expect(updated).toBe("See [@smith2024]. Also alone.\n");
    expect(await collectPaperCitedKeys(root, paperRel)).toEqual(["smith2024"]);
  });
});
