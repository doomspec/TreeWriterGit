#!/usr/bin/env node
/**
 * Import a .docx Word document into a paper as sections and units.
 *
 * Requires pandoc (`brew install pandoc`) unless --markdown is used.
 *
 * Usage:
 *   pnpm import-docx papers/my-paper /path/to/manuscript.docx
 *   pnpm import-docx papers/my-paper /path/to/manuscript.docx --no-approve
 *   pnpm import-docx papers/my-paper /path/to/converted.md --markdown
 *   pnpm import-docx papers/my-paper chapter.docx --json
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { importDocxIntoPaper, importMarkdownIntoPaper } from "../view/backend/src/docxImport.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = path.join(repoRoot, "model");

function usage(exitCode = 1) {
  process.stderr.write(`Import Word or markdown into a paper tree.

Usage:
  pnpm import-docx <paper-slug-or-path> <file.docx> [--section NAME] [--replace] [--no-approve] [--json]
  pnpm import-docx <paper-slug-or-path> <file.md> --markdown [--section NAME] [--replace] [--no-approve] [--json]

Options:
  --section NAME Import under papers/{slug}/{NAME} instead of the paper root
  --replace      Remove existing children of the import target before importing
  --markdown     Treat input as pandoc GFM markdown (skip pandoc conversion)
  --no-approve   Leave imported unit drafts unapproved
  --json         Print machine-readable result
  --help, -h     Show this help

Examples:
  pnpm import-docx papers/demo-paper ~/Downloads/chapter.docx
  pnpm import-docx dyi_bioprinting chapter.docx --section body --replace
  pnpm import-docx vibecount export/preview.md --markdown --json
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const flags = { json: false, markdown: false, noApprove: false, replace: false };
  const positional = [];
  let targetSection;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") flags.json = true;
    else if (arg === "--markdown") flags.markdown = true;
    else if (arg === "--no-approve") flags.noApprove = true;
    else if (arg === "--replace") flags.replace = true;
    else if (arg === "--help" || arg === "-h") usage(0);
    else if (arg === "--section") {
      targetSection = argv[index + 1]?.trim();
      if (!targetSection) {
        process.stderr.write("--section requires a section folder name\n");
        usage();
      }
      index += 1;
    } else if (arg.startsWith("-")) {
      process.stderr.write(`Unknown option: ${arg}\n`);
      usage();
    } else positional.push(arg);
  }
  return { flags, positional, targetSection };
}

function cliArgs() {
  const raw = process.argv.slice(2);
  return raw[0] === "--" ? raw.slice(1) : raw;
}

const { flags, positional, targetSection } = parseArgs(cliArgs());
const paperArg = positional[0];
const inputPath = positional[1];

if (!paperArg || !inputPath) usage();

const paperSlug = paperArg.replace(/^papers\//, "").replace(/\/+$/, "");
const options = {
  autoApprove: !flags.noApprove,
  approvedBy: "docx-import-cli",
  targetSection: targetSection || undefined,
  replaceTarget: flags.replace,
};

let result;
if (flags.markdown) {
  const markdown = await readFile(path.resolve(inputPath), "utf8");
  result = await importMarkdownIntoPaper(modelRoot, paperSlug, markdown, options);
} else {
  const buffer = await readFile(path.resolve(inputPath));
  result = await importDocxIntoPaper(modelRoot, paperSlug, buffer, options);
}

if (flags.json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`Sections created: ${result.sectionsCreated}`);
console.log(`Units created: ${result.unitsCreated}`);
if (result.paperTitle) console.log(`Paper title: ${result.paperTitle}`);
if (result.notice) console.log(`Notice: ${result.notice}`);
console.log(`Paths (${result.paths.length}):`);
for (const rel of result.paths.slice(0, 20)) {
  console.log(`  ${rel}`);
}
if (result.paths.length > 20) {
  console.log(`  … and ${result.paths.length - 20} more`);
}
