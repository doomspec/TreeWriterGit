import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { listMainBibReferences, type BibReferenceMetadata } from "./bibLibrary.js";
import { extractCiteKeys, removeCiteKeyFromMarkdown } from "./export/bibliography.js";
import { walkManuscript } from "./model/index.js";

/** Collect unique cite keys from all draft.md files under a paper. */
export async function collectPaperCitedKeys(modelRoot: string, paperRel: string): Promise<string[]> {
  const keys = new Set<string>();

  await walkManuscript(modelRoot, paperRel, {
    enter: async (ctx) => {
      const draftAbs = path.join(modelRoot, ctx.relPath, "draft.md");
      if (!existsSync(draftAbs)) return;
      const content = await readFile(draftAbs, "utf8");
      for (const key of extractCiteKeys(content)) keys.add(key);
    },
  });

  return [...keys].sort();
}

/** Resolve cited keys to main.bib metadata; include stubs for keys missing from the library. */
export async function listPaperCitedReferences(
  modelRoot: string,
  paperRel: string,
): Promise<BibReferenceMetadata[]> {
  const citeKeys = await collectPaperCitedKeys(modelRoot, paperRel);
  if (citeKeys.length === 0) return [];

  const byKey = new Map(
    (await listMainBibReferences(modelRoot)).map((reference) => [reference.citeKey, reference]),
  );

  return citeKeys.map((citeKey) => {
    const existing = byKey.get(citeKey);
    if (existing) return existing;
    return {
      path: `main.bib#${citeKey}`,
      citeKey,
      title: citeKey,
      authors: null,
      year: null,
      journal: null,
      doi: null,
      type: "article",
      verifiedStatus: "unverified" as const,
      integrity: null,
      missingFromLibrary: true,
    };
  });
}

/** Strip a cite key from every unit draft.md under a paper. */
export async function removeCiteKeyFromPaperDrafts(
  modelRoot: string,
  paperRel: string,
  citeKey: string,
): Promise<{ modified: string[] }> {
  const modified: string[] = [];

  await walkManuscript(modelRoot, paperRel, {
    enter: async (ctx) => {
      const draftRel = `${ctx.relPath}/draft.md`;
      const draftAbs = path.join(modelRoot, draftRel);
      if (!existsSync(draftAbs)) return;
      const original = await readFile(draftAbs, "utf8");
      const { content, removed } = removeCiteKeyFromMarkdown(original, citeKey);
      if (!removed) return;
      await writeFile(draftAbs, content, "utf8");
      modified.push(draftRel);
    },
  });

  return { modified };
}
