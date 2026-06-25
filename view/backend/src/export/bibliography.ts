import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import matter from "gray-matter";

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

/** Build a .bib file from literature notes for the keys referenced in the export. */
export async function buildBibliography(
  modelRoot: string,
  paperRel: string,
  combinedMarkdown: string,
): Promise<string> {
  const wanted = new Set(extractCiteKeys(combinedMarkdown));
  if (wanted.size === 0) return "";

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
