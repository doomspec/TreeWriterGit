#!/usr/bin/env node
/**
 * TreeWriter Zotero local CLI — search/import citations via backend proxy.
 *
 * Usage (from repo root or model/):
 *   node scripts/tw-zotero.mjs status
 *   node scripts/tw-zotero.mjs search "CRISPR viability" --limit 10
 *   node scripts/tw-zotero.mjs import --keys ITEMKEY1,ITEMKEY2
 *   node scripts/tw-zotero.mjs snippet --keys smith2020,jones2021
 */

const DEFAULT_API = process.env.TREEWRITER_API_URL ?? "http://localhost:4000";

function usage(exitCode = 1) {
  process.stderr.write(`TreeWriter Zotero local CLI

Commands:
  status                                     Check extension enabled + Zotero connection
  search <query> [--limit N]                 Search local Zotero library
  import --keys k1,k2                        Import items into main.bib
  snippet --keys k1,k2                       Print [@k1; @k2] citation markup

Options:
  --json                                     JSON output
  --api URL                                  Backend base URL (default: ${DEFAULT_API})

Requires Settings → Extensions → Enable local Zotero and pnpm dev.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const positional = [];
  const flags = { json: false, api: DEFAULT_API, limit: 20, keys: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") flags.json = true;
    else if (arg === "--limit") flags.limit = Number(argv[++i]);
    else if (arg === "--keys") flags.keys = argv[++i] ?? "";
    else if (arg === "--api") flags.api = argv[++i] ?? DEFAULT_API;
    else if (arg === "--help" || arg === "-h") usage(0);
    else if (arg.startsWith("-")) {
      process.stderr.write(`Unknown option: ${arg}\n`);
      usage();
    } else positional.push(arg);
  }
  return { positional, flags };
}

async function fetchJson(baseUrl, pathname, init = {}) {
  const url = new URL(pathname, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body ? body.error : text.slice(0, 200);
    throw new Error(`API ${response.status}: ${message}`);
  }
  return body;
}

function formatSnippet(keys) {
  const list = keys
    .split(",")
    .map((key) => key.trim().replace(/^@/, ""))
    .filter(Boolean);
  const seen = new Set();
  const normalized = [];
  for (const key of list) {
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  if (normalized.length === 0) return "";
  if (normalized.length === 1) return `[@${normalized[0]}]`;
  return `[@${normalized.join("; @")}]`;
}

async function cmdStatus(flags) {
  const data = await fetchJson(flags.api, "/api/zotero/local/status");
  if (!data.enabled) {
    throw new Error("Local Zotero is disabled — enable it in Settings → Extensions");
  }
  if (!data.connected) {
    throw new Error("Zotero desktop is not running or not reachable");
  }
  return data;
}

async function cmdSearch(query, flags) {
  const params = new URLSearchParams({ q: query, limit: String(flags.limit) });
  return fetchJson(flags.api, `/api/zotero/local/search?${params}`);
}

async function cmdImport(flags) {
  const itemKeys = flags.keys
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  if (itemKeys.length === 0) {
    throw new Error("import requires --keys k1,k2");
  }
  return fetchJson(flags.api, "/api/zotero/local/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemKeys }),
  });
}

function cmdSnippet(flags) {
  const snippet = formatSnippet(flags.keys);
  if (!snippet) throw new Error("snippet requires --keys k1,k2");
  return flags.json ? { snippet, keys: flags.keys.split(",").map((k) => k.trim()) } : snippet;
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  if (!command) usage();

  let result;
  switch (command) {
    case "status":
      result = await cmdStatus(flags);
      break;
    case "search": {
      const query = positional.slice(1).join(" ").trim();
      if (!query) {
        process.stderr.write("search requires a query.\n");
        usage();
      }
      result = await cmdSearch(query, flags);
      break;
    }
    case "import":
      result = await cmdImport(flags);
      break;
    case "snippet":
      result = cmdSnippet(flags);
      break;
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
