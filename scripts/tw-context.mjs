#!/usr/bin/env node
/**
 * TreeWriter context CLI — on-demand manuscript lookup for AI dispatch.
 * Prefer this over project MCP: zero always-on context cost; pay only when invoked.
 *
 * Usage (from repo root or model/):
 *   node scripts/tw-context.mjs search "viability" --root papers/demo
 *   node scripts/tw-context.mjs read papers/demo/intro/draft.md
 *   node scripts/tw-context.mjs tree papers/demo --depth 1
 *   node scripts/tw-context.mjs compose papers/demo/sections/intro
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_API = process.env.TREEWRITER_API_URL ?? "http://localhost:4000";

function usage(exitCode = 1) {
  process.stderr.write(`TreeWriter context CLI

Commands:
  search <query> [--root PATH] [--limit N]   FTS search (API; falls back to grep)
  read <path>                                Read a model file (direct FS)
  tree [path] [--depth N]                    Subtree listing (API; falls back to FS)
  compose <sectionPath> [--approved]         Section compose view (API)

Options:
  --json                                     JSON output
  --api URL                                  Backend base URL (default: ${DEFAULT_API})

Run from repo root or model/. Requires backend for search/compose when using API.
`);
  process.exit(exitCode);
}

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i += 1) {
    if (
      existsSync(path.join(dir, "model")) &&
      existsSync(path.join(dir, "scripts", "tw-context.mjs"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseArgs(argv) {
  const positional = [];
  const flags = { json: false, api: DEFAULT_API, root: "", depth: undefined, limit: 20, approved: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") flags.json = true;
    else if (arg === "--approved") flags.approved = true;
    else if (arg === "--root") flags.root = argv[++i] ?? "";
    else if (arg === "--depth") flags.depth = Number(argv[++i]);
    else if (arg === "--limit") flags.limit = Number(argv[++i]);
    else if (arg === "--api") flags.api = argv[++i] ?? DEFAULT_API;
    else if (arg === "--help" || arg === "-h") usage(0);
    else if (arg.startsWith("-")) {
      process.stderr.write(`Unknown option: ${arg}\n`);
      usage();
    } else positional.push(arg);
  }
  return { positional, flags };
}

function normalizeModelPath(relPath) {
  return relPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function assertSafeModelPath(relPath) {
  const normalized = normalizeModelPath(relPath);
  if (!normalized || normalized.includes("..")) {
    throw new Error(`Unsafe path: ${relPath}`);
  }
  return normalized;
}

async function fetchJson(baseUrl, pathname, params = {}) {
  const url = new URL(pathname, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

function walkMarkdownFiles(absDir, modelRoot, acc) {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(abs, modelRoot, acc);
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      acc.push(path.relative(modelRoot, abs).split(path.sep).join("/"));
    }
  }
}

function grepSearch(modelRoot, query, rootRel, limit) {
  const needle = query.toLowerCase();
  const rootAbs = rootRel ? path.join(modelRoot, rootRel) : modelRoot;
  const files = [];
  walkMarkdownFiles(rootAbs, modelRoot, files);
  const hits = [];
  for (const rel of files.sort()) {
    if (hits.length >= limit) break;
    let content;
    try {
      content = readFileSync(path.join(modelRoot, rel), "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const idx = line.toLowerCase().indexOf(needle);
      if (idx === -1) continue;
      const start = Math.max(0, idx - 40);
      const end = Math.min(line.length, idx + query.length + 40);
      let excerpt = line.slice(start, end).replace(/\s+/g, " ").trim();
      if (start > 0) excerpt = `…${excerpt}`;
      if (end < line.length) excerpt = `${excerpt}…`;
      hits.push({ path: rel, line: i + 1, excerpt });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

function formatSearchHits(hits) {
  if (hits.length === 0) return "No matches.";
  return hits.map((hit) => `${hit.path}:${hit.line}\n  ${hit.excerpt}`).join("\n\n");
}

async function cmdSearch(query, flags, modelRoot) {
  let hits;
  try {
    const data = await fetchJson(flags.api, "/api/model/search", {
      q: query,
      root: flags.root,
      limit: flags.limit,
    });
    hits = data.results ?? [];
  } catch {
    hits = grepSearch(modelRoot, query, flags.root, flags.limit);
  }
  if (flags.json) return hits;
  return formatSearchHits(hits);
}

function cmdRead(relPath, flags, modelRoot) {
  const safe = assertSafeModelPath(relPath);
  const abs = path.join(modelRoot, safe);
  if (!existsSync(abs)) throw new Error(`Not found: ${safe}`);
  const content = readFileSync(abs, "utf8");
  if (flags.json) return { path: safe, content };
  return content;
}

function listTreeFs(modelRoot, rootRel, depth) {
  const rootAbs = rootRel ? path.join(modelRoot, rootRel) : modelRoot;
  const walk = (abs, rel, remaining) => {
    const entries = readdirSync(abs, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));
    const lines = [];
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const prefix = entry.isDirectory() ? `${childRel}/` : childRel;
      lines.push(prefix);
      if (entry.isDirectory() && remaining !== 0) {
        lines.push(...walk(path.join(abs, entry.name), childRel, remaining === undefined ? undefined : remaining - 1));
      }
    }
    return lines;
  };
  return walk(rootAbs, rootRel, depth);
}

async function cmdTree(rootRel, flags, modelRoot) {
  const normalized = normalizeModelPath(rootRel);
  try {
    const data = await fetchJson(flags.api, "/api/model/tree", {
      path: normalized,
      depth: flags.depth,
    });
    if (flags.json) return data;
    const flatten = (nodes, indent = "") => {
      const lines = [];
      for (const node of nodes ?? []) {
        const label = node.type === "directory" ? `${node.path}/` : node.path;
        lines.push(`${indent}${label}`);
        if (node.children) lines.push(...flatten(node.children, `${indent}  `));
        else if (node.hasChildren) lines.push(`${indent}  …`);
      }
      return lines;
    };
    return flatten(data.tree).join("\n") || "(empty)";
  } catch {
    const lines = listTreeFs(modelRoot, normalized, flags.depth);
    if (flags.json) return { root: normalized || "model", paths: lines };
    return lines.join("\n") || "(empty)";
  }
}

async function cmdCompose(sectionPath, flags) {
  const normalized = assertSafeModelPath(sectionPath);
  const data = await fetchJson(flags.api, "/api/model/section-compose", {
    path: normalized,
    approvedOnly: flags.approved ? "true" : undefined,
  });
  if (flags.json) return data;
  const parts = [`# ${data.title ?? normalized}`, ""];
  if (data.outlineMarkdown) parts.push("## Outline\n", data.outlineMarkdown.trim(), "");
  if (data.draftMarkdown) parts.push("## Draft\n", data.draftMarkdown.trim(), "");
  return parts.join("\n").trim();
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  if (!command) usage();

  const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  if (!repoRoot) {
    process.stderr.write("Could not find TreeWriter repo root (need model/ + scripts/tw-context.mjs).\n");
    process.exit(1);
  }
  const modelRoot = path.join(repoRoot, "model");

  let result;
  switch (command) {
    case "search": {
      const query = positional.slice(1).join(" ").trim();
      if (!query) {
        process.stderr.write("search requires a query.\n");
        usage();
      }
      result = await cmdSearch(query, flags, modelRoot);
      break;
    }
    case "read": {
      const relPath = positional[1];
      if (!relPath) {
        process.stderr.write("read requires a path.\n");
        usage();
      }
      result = cmdRead(relPath, flags, modelRoot);
      break;
    }
    case "tree": {
      const rootRel = positional[1] ?? "";
      result = await cmdTree(rootRel, flags, modelRoot);
      break;
    }
    case "compose": {
      const sectionPath = positional[1];
      if (!sectionPath) {
        process.stderr.write("compose requires a section path.\n");
        usage();
      }
      result = await cmdCompose(sectionPath, flags);
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      usage();
  }

  const output = flags.json ? JSON.stringify(result, null, 2) : String(result);
  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
