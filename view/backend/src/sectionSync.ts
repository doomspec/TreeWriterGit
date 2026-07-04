import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { orderedChildren, readIndexData, reorderChildren, isEquationDir, isFigureDir, isTableDir, isUnitDir, resolveChildPath } from "./modelFs.js";
import { isManuscriptRoot } from "./model/manuscriptKind.js";
import { displayChildTitle } from "./compose.js";

async function isSectionContainerDir(modelRoot: string, relPath: string): Promise<boolean> {
  if (await isUnitDir(modelRoot, relPath)) return false;
  if (await isFigureDir(modelRoot, relPath)) return false;
  if (await isTableDir(modelRoot, relPath)) return false;
  if (await isEquationDir(modelRoot, relPath)) return false;
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "unit" || data.kind === "figure" || data.kind === "table" || data.kind === "equation") return false;
  return (await orderedChildren(modelRoot, relPath)).length > 0;
}

function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "").trim();
}

export type LinkedBlock = {
  title: string;
  href: string;
  body: string;
};

export type OutlineListItem = {
  title: string;
  href: string;
  note?: string;
};

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** Resolve a child folder path from a markdown link in a section outline/draft. */
export function resolveChildHref(sectionRel: string, href: string): string | null {
  const clean = href.split("#")[0]?.trim();
  if (!clean || clean.startsWith("http")) return null;

  if (clean.endsWith("/INDEX.md") || clean === "INDEX.md") {
    const dir = clean.replace(/\/?INDEX\.md$/, "");
    if (!dir) return sectionRel || null;
    return sectionRel ? `${sectionRel}/${dir}`.replace(/\/+/g, "/") : dir;
  }

  if (clean.endsWith(".md")) {
    const dir = path.posix.dirname(clean);
    if (!dir || dir === ".") return sectionRel || null;
    return sectionRel ? `${sectionRel}/${dir}`.replace(/\/+/g, "/") : dir;
  }

  if (!clean.includes("/")) {
    return sectionRel ? `${sectionRel}/${clean}`.replace(/\/+/g, "/") : clean;
  }

  return sectionRel ? `${sectionRel}/${clean}`.replace(/\/+/g, "/") : clean;
}

/** Text before the first linked ##/### heading in a composed draft. */
export function extractPreambleBeforeLinkedHeadings(markdown: string): {
  preamble: string;
  remainder: string;
} {
  const stripped = stripFrontmatter(markdown)
    .replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "")
    .trimStart();
  const lines = stripped.split("\n");
  const idx = lines.findIndex((line) => /^#{2,4}\s+\[[^\]]+\]\([^)]+\)\s*$/.test(line.trim()));
  if (idx === -1) {
    return { preamble: stripped.trim(), remainder: "" };
  }
  return {
    preamble: lines.slice(0, idx).join("\n").trim(),
    remainder: lines.slice(idx).join("\n").trim(),
  };
}
export function parseOutlineListItems(markdown: string): OutlineListItem[] {
  const body = stripFrontmatter(markdown);
  const outlineMatch = body.match(/##\s+Outline\s*\n([\s\S]*?)(?=\n##\s|\n#[^#]|$)/i);
  if (!outlineMatch?.[1]) return [];

  const items: OutlineListItem[] = [];
  for (const line of outlineMatch[1].split("\n")) {
    const match = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)(?:\s*[—–-]\s*(.+))?/);
    if (match) {
      items.push({
        title: match[1].trim(),
        href: match[2].trim(),
        note: match[3]?.trim(),
      });
    }
  }
  return items;
}

/** Parse `## [Title](href)` blocks from composed section drafts/outlines. */
export function parseLinkedHeadingBlocks(markdown: string): LinkedBlock[] {
  const blocks: LinkedBlock[] = [];
  const re = /^#{2,4}\s+\[([^\]]+)\]\(([^)]+)\)\s*\r?\n([\s\S]*?)(?=^#{2,4}\s+\[|\s*$)/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    blocks.push({
      title: match[1].trim(),
      href: match[2].trim(),
      body: match[3].trim(),
    });
  }
  return blocks;
}

function normalizeProse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** True when free text before the first linked heading repeats the first block body. */
export function isDuplicateComposedPreamble(preamble: string, firstBlockBody: string): boolean {
  const a = normalizeProse(preamble);
  const b = normalizeProse(firstBlockBody);
  if (!a || !b) return false;
  return a === b || b.includes(a) || a.includes(b);
}

/** Drop orphan prose that duplicates the first linked child block. */
export function stripDuplicateComposedPreamble(markdown: string, sectionTitle = "Section"): string {
  const { preamble, remainder } = extractPreambleBeforeLinkedHeadings(markdown);
  if (!preamble || !remainder) return markdown;
  const blocks = parseLinkedHeadingBlocks(`# ${sectionTitle}\n\n${remainder}`);
  if (blocks.length === 0) return markdown;
  if (!isDuplicateComposedPreamble(preamble, blocks[0].body)) return markdown;
  return `# ${sectionTitle}\n\n${remainder}\n`.trimEnd() + "\n";
}

/** Normalize composed section draft body for editing (no document H1). */
export function normalizeComposedDraftBody(body: string, sectionTitle = "Section"): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const withTitle = trimmed.startsWith("# ") ? trimmed : `# ${sectionTitle}\n\n${trimmed}\n`;
  return stripDuplicateComposedPreamble(withTitle, sectionTitle)
    .replace(/^#\s+[^\n]+\n+/, "")
    .trimEnd();
}

function upsertSummarySection(markdown: string, summary: string): string {
  const body = stripFrontmatter(markdown);
  const h1Match = body.match(/^\s*#(?!#)\s+[^\n]+\n?/);
  const h1 = h1Match?.[0] ?? "# Section\n\n";
  const rest = body.slice(h1Match?.[0]?.length ?? 0);

  if (/##\s+Summary/i.test(rest)) {
    const updated = rest.replace(
      /##\s+Summary\s*\n[\s\S]*?(?=\n##\s|\n#[^#]|$)/i,
      `## Summary\n\n${summary}\n\n`,
    );
    return `${h1}${updated}`.trimEnd() + "\n";
  }

  return `${h1}## Summary\n\n${summary}\n\n${rest}`.trimEnd() + "\n";
}

async function writeChildOutlineSummary(
  modelRoot: string,
  childRel: string,
  title: string,
  summary: string,
): Promise<string> {
  const outlineRel = `${childRel}/outline.md`;
  const outlineAbs = path.join(modelRoot, outlineRel);
  let existing = `# ${title}\n\n`;
  if (existsSync(outlineAbs)) {
    existing = await readFile(outlineAbs, "utf8");
  } else {
    await mkdir(path.dirname(outlineAbs), { recursive: true });
  }
  const updated = upsertSummarySection(existing, summary);
  await writeFile(outlineAbs, updated, "utf8");
  return outlineRel;
}

async function writeChildDraft(modelRoot: string, childRel: string, body: string): Promise<string> {
  const draftRel = `${childRel}/draft.md`;
  const draftAbs = path.join(modelRoot, draftRel);
  await mkdir(path.dirname(draftAbs), { recursive: true });
  const normalized = body.trim() ? `${stripLeadingH1(body).trimEnd()}\n` : "";
  await writeFile(draftAbs, normalized, "utf8");
  return draftRel;
}

function childNameFromHref(sectionRel: string, href: string): string | null {
  const childRel = resolveChildHref(sectionRel, href);
  if (!childRel || !childRel.startsWith(`${sectionRel}/`)) return null;
  return childRel.slice(sectionRel.length + 1).split("/")[0] ?? null;
}

/** Push section outline edits to child folders (order + per-child summaries). */
export async function syncSectionOutlineToChildren(
  modelRoot: string,
  sectionRel: string,
  outlineMarkdown: string,
): Promise<string[]> {
  const children = await orderedChildren(modelRoot, sectionRel);
  if (children.length === 0) return [];

  const updated = new Set<string>();
  const listItems = parseOutlineListItems(outlineMarkdown);
  const linkedBlocks = parseLinkedHeadingBlocks(outlineMarkdown);

  const orderFromList = listItems
    .map((item) => childNameFromHref(sectionRel, item.href))
    .filter((name): name is string => Boolean(name));
  if (orderFromList.length > 0) {
    const validOrder = orderFromList.filter((name) => children.includes(name));
    if (validOrder.length > 0 && validOrder.join(",") !== children.join(",")) {
      await reorderChildren(modelRoot, sectionRel, validOrder);
      updated.add(`${sectionRel}/INDEX.md`);
    }
  }

  for (const item of listItems) {
    if (!item.note) continue;
    const childRel = resolveChildHref(sectionRel, item.href);
    if (!childRel) continue;
    const childName = path.posix.basename(childRel);
    const childIndex = await readIndexData(modelRoot, childRel);
    const title = displayChildTitle(childIndex.title, childName);
    updated.add(await writeChildOutlineSummary(modelRoot, childRel, title, item.note));
  }

  for (const block of linkedBlocks) {
    if (!block.body) continue;
    const childRel = resolveChildHref(sectionRel, block.href);
    if (!childRel) continue;
    updated.add(await writeChildOutlineSummary(modelRoot, childRel, block.title, block.body));
  }

  return [...updated];
}

/** Split a composed section draft into child draft.md files. */
export async function syncSectionDraftToChildren(
  modelRoot: string,
  sectionRel: string,
  draftMarkdown: string,
  hrefRoot: string = sectionRel,
): Promise<string[]> {
  const children = await orderedChildren(modelRoot, sectionRel);
  const indexData = await readIndexData(modelRoot, sectionRel);
  const sectionTitle = String(indexData.title ?? path.posix.basename(sectionRel));

  if (children.length === 0) {
    let workingMarkdown = draftMarkdown;
    if (indexData.kind !== "paper") {
      workingMarkdown = stripDuplicateComposedPreamble(workingMarkdown, sectionTitle);
    }
    const body = stripLeadingH1(workingMarkdown);
    if (!body.trim()) return [];
    return [await writeChildDraft(modelRoot, sectionRel, body)];
  }

  const updated = new Set<string>();

  let workingMarkdown = draftMarkdown;
  if (isManuscriptRoot(indexData)) {
    const { preamble, remainder } = extractPreambleBeforeLinkedHeadings(draftMarkdown);
    if (preamble) {
      updated.add(await writeChildOutlineSummary(modelRoot, sectionRel, sectionTitle, preamble));
    }
    workingMarkdown = remainder
      ? `# ${sectionTitle}\n\n${remainder}\n`
      : draftMarkdown;
  } else {
    workingMarkdown = stripDuplicateComposedPreamble(workingMarkdown, sectionTitle);
  }

  let blocks = parseLinkedHeadingBlocks(workingMarkdown);
  if (blocks.length === 0) {
    const unitChildren: string[] = [];
    for (const childName of children) {
      const childRel = resolveChildPath(modelRoot, sectionRel, childName);
      if (!childRel) continue;
      if (await isUnitDir(modelRoot, childRel)) unitChildren.push(childRel);
    }
    if (unitChildren.length === 1) {
      const body = stripLeadingH1(workingMarkdown);
      if (body) {
        updated.add(await writeChildDraft(modelRoot, unitChildren[0], body));
      }
    }
    return [...updated];
  }
  for (const block of blocks) {
    const childRel = resolveChildHref(hrefRoot, block.href);
    if (!childRel) continue;
    if (await isSectionContainerDir(modelRoot, childRel)) {
      for (const path of await syncSectionDraftToChildren(
        modelRoot,
        childRel,
        block.body,
        hrefRoot,
      )) {
        updated.add(path);
      }
    } else {
      updated.add(await writeChildDraft(modelRoot, childRel, block.body));
    }
  }

  return [...updated];
}
