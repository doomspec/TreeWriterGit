#!/usr/bin/env node
/**
 * Import a .bib file into papers/{slug}/notes/literature/ as literature notes.
 *
 * Usage:
 *   pnpm exec tsx scripts/import-references.mjs papers/vibecount /path/to/references.bib
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { importBibtexReferences } from "../view/backend/src/bibtexImport.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = path.join(repoRoot, "model");

const paperRel = process.argv[2];
const bibPath = process.argv[3];

if (!paperRel || !bibPath) {
  console.error("Usage: tsx scripts/import-references.mjs <paper-path> <references.bib>");
  process.exit(1);
}

const bibtex = await readFile(path.resolve(bibPath), "utf8");
const result = await importBibtexReferences(modelRoot, paperRel, bibtex, { skipExisting: true });

console.log(`Created: ${result.created.length}`);
console.log(`Skipped: ${result.skipped.length}`);
if (result.errors.length > 0) {
  console.error("Errors:", result.errors.slice(0, 10).join("\n"));
  if (result.errors.length > 10) {
    console.error(`… and ${result.errors.length - 10} more`);
  }
}
