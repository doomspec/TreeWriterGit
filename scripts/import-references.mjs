#!/usr/bin/env node
/**
 * Import a .bib file into papers/{slug}/notes/literature/ as literature notes.
 *
 * Usage:
 *   pnpm import-references papers/vibecount /path/to/references.bib
 *   pnpm import-references papers/vibecount refs.bib --json
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { importBibtexReferences } from "../view/backend/src/bibtexImport.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = path.join(repoRoot, "model");

function usage(exitCode = 1) {
  process.stderr.write(`Import BibTeX references into a paper literature folder.

Usage:
  pnpm import-references <paper-path> <references.bib> [--json]
  pnpm import-references --help

Options:
  --json         Print machine-readable result
  --help, -h     Show this help
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const flags = { json: false };
  const positional = [];
  for (const arg of argv) {
    if (arg === "--json") flags.json = true;
    else if (arg === "--help" || arg === "-h") usage(0);
    else if (arg.startsWith("-")) {
      process.stderr.write(`Unknown option: ${arg}\n`);
      usage();
    } else positional.push(arg);
  }
  return { flags, positional };
}

function cliArgs() {
  const raw = process.argv.slice(2);
  return raw[0] === "--" ? raw.slice(1) : raw;
}

const { flags, positional } = parseArgs(cliArgs());
const paperRel = positional[0];
const bibPath = positional[1];

if (!paperRel || !bibPath) usage();

const bibtex = await readFile(path.resolve(bibPath), "utf8");
const result = await importBibtexReferences(modelRoot, paperRel, bibtex, { skipExisting: true });

if (flags.json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`Created: ${result.created.length}`);
console.log(`Skipped: ${result.skipped.length}`);
if (result.errors.length > 0) {
  console.error("Errors:", result.errors.slice(0, 10).join("\n"));
  if (result.errors.length > 10) {
    console.error(`… and ${result.errors.length - 10} more`);
  }
}
