import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import matter from "gray-matter";
import { bibtexForCiteKeys } from "../bibLibrary.js";

function journalSlug(journal: string): string {
  return journal
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Resolve optional CSL from template export.csl, then journal slug → model/templates/{slug}.csl */
export function resolveCslPath(
  modelRoot: string,
  journal: string,
  preferredCsl?: string,
): string | null {
  const candidates: string[] = [];
  if (preferredCsl) {
    candidates.push(path.join(modelRoot, "templates", preferredCsl));
    candidates.push(path.join(modelRoot, "shared", preferredCsl));
  }
  const slug = journalSlug(journal);
  if (slug) {
    candidates.push(path.join(modelRoot, "templates", `${slug}.csl`));
    candidates.push(path.join(modelRoot, "shared", `${slug}.csl`));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Extract pandoc cite keys from `[@a, b]` and bare `@key` tokens. */
export function extractCiteKeys(markdown: string): string[] {
  const keys = new Set<string>();
  for (const match of markdown.matchAll(/\[@([^\]]+)\]/g)) {
    for (const part of match[1].split(/[,;]/)) {
      const key = part.trim().replace(/^@/, "");
      if (key) keys.add(key);
    }
  }
  for (const match of markdown.matchAll(/(?<![\w/@])@([a-zA-Z][\w-]+)/g)) {
    keys.add(match[1]);
  }
  return [...keys].sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCitationInner(inner: string): string[] {
  return inner
    .split(/[,;]/)
    .map((part) => part.trim().replace(/^@/, ""))
    .filter(Boolean);
}

function formatCitationKeys(keys: string[]): string {
  if (keys.length === 0) return "";
  if (keys.length === 1) return `[@${keys[0]}]`;
  return `[@${keys.join("; @")}]`;
}

/** Remove one cite key from pandoc `[@…]` groups and bare `@key` tokens. */
export function removeCiteKeyFromMarkdown(
  markdown: string,
  citeKey: string,
): { content: string; removed: boolean } {
  let removed = false;
  let content = markdown.replace(/\[@([^\]]+)\]/g, (match, inner: string) => {
    const keys = parseCitationInner(inner);
    const filtered = keys.filter((key) => key !== citeKey);
    if (filtered.length === keys.length) return match;
    removed = true;
    return formatCitationKeys(filtered);
  });

  const barePattern = new RegExp(`(?<![\\w/@])@${escapeRegExp(citeKey)}(?![\\w-])`, "g");
  content = content.replace(barePattern, () => {
    removed = true;
    return "";
  });

  if (!removed) return { content: markdown, removed: false };

  content = content
    .replace(/\s+and\s+([,.;:!?])/g, "$1")
    .replace(/\s+,\s+([,.;:!?])/g, "$1")
    .replace(/\s+and\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1");

  return { content, removed: true };
}

function bibEntryFromNote(citeKey: string, data: Record<string, unknown>, body: string): string {
  const title =
    String(data.title ?? "").trim() ||
    body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ||
    citeKey;
  const authors = String(data.authors ?? "Unknown");
  const year = String(data.year ?? "n.d.");
  const journal = String(data.journal ?? "");
  const doi = String(data.doi ?? "");

  const lines = [
    `@article{${citeKey},`,
    `  title={${title.replace(/[{}]/g, "")}},`,
    `  author={${authors.replace(/[{}]/g, "")}},`,
    `  year={${year}},`,
  ];
  if (journal) lines.push(`  journal={${journal.replace(/[{}]/g, "")}},`);
  if (doi) lines.push(`  doi={${doi}},`);
  lines.push("}");
  return lines.join("\n");
}

async function buildBibliographyFromLiteratureNotes(
  modelRoot: string,
  paperRel: string,
  wanted: Set<string>,
): Promise<string> {
  const literatureDir = path.join(modelRoot, paperRel, "notes", "literature");
  if (!existsSync(literatureDir)) return "";

  const entries: string[] = [];
  for (const file of await readdir(literatureDir)) {
    if (!file.endsWith(".md") || file === "INDEX.md" || file === "outline.md" || file === "draft.md") {
      continue;
    }
    const raw = await readFile(path.join(literatureDir, file), "utf8");
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    if (data.type !== "literature" && !data.cite_key) continue;
    const citeKey = String(data.cite_key ?? file.replace(/\.md$/, ""));
    if (!wanted.has(citeKey)) continue;
    entries.push(bibEntryFromNote(citeKey, data, parsed.content));
  }

  return entries.join("\n\n");
}

/** Build a .bib file from centralized main.bib, falling back to legacy literature notes. */
export async function buildBibliography(
  modelRoot: string,
  paperRel: string,
  combinedMarkdown: string,
): Promise<string> {
  const wanted = new Set(extractCiteKeys(combinedMarkdown));
  if (wanted.size === 0) return "";

  const mainBib = await bibtexForCiteKeys(modelRoot, wanted);
  const covered = new Set<string>();
  for (const match of mainBib.matchAll(/@\w+\{([^,\s]+)/g)) covered.add(match[1]);
  const missingFromMain = new Set([...wanted].filter((key) => !covered.has(key)));
  const legacyBib = await buildBibliographyFromLiteratureNotes(modelRoot, paperRel, missingFromMain);
  return [mainBib.trim(), legacyBib.trim()].filter(Boolean).join("\n\n");
}

/** Cite keys in markdown that have no matching @entry in the generated bibliography. */
export function findMissingCitations(combinedMarkdown: string, bibliography: string): string[] {
  const wanted = extractCiteKeys(combinedMarkdown);
  if (!bibliography.trim()) return wanted;
  const inBib = new Set<string>();
  for (const match of bibliography.matchAll(/@\w+\{([^,\s]+)/g)) {
    inBib.add(match[1]);
  }
  return wanted.filter((key) => !inBib.has(key));
}
