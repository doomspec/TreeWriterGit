import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { isFigureDir, isTableDir, isUnitDir, orderedChildren, readIndexData, resolveChildPath } from "./modelFs.js";
import { resolveFigureMetadata } from "./figures.js";
import { resolveTableMetadata } from "./tables.js";

export type SectionChild = {
  name: string;
  path: string;
  title: string;
  summary: string | null;
  kind: "unit" | "section" | "figure" | "table";
};

export type SectionComposeResult = {
  path: string;
  title: string;
  kind: string | null;
  outlineMarkdown: string;
  draftMarkdown: string;
  children: SectionChild[];
};

function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Use titleCase(folderName) when INDEX title is missing or equals the slug. */
export function displayChildTitle(indexTitle: unknown, folderName: string): string {
  const slug = folderName.toLowerCase();
  const fromIndex = String(indexTitle ?? "").trim();
  if (!fromIndex || fromIndex.toLowerCase().replace(/\s+/g, "-") === slug) {
    return titleCase(folderName);
  }
  return fromIndex;
}

function linkedHeadingBlock(
  depth: number,
  childTitle: string,
  linkHref: string,
  body = "",
): string {
  const heading = "#".repeat(Math.min(depth + 1, 4));
  const block = `${heading} [${childTitle}](${linkHref})\n\n`;
  return body ? `${block}${body}\n\n` : block;
}

function draftHeadingBlock(
  depth: number,
  childTitle: string,
  linkHref: string,
  body: string,
): string {
  return linkedHeadingBlock(depth, childTitle, linkHref, body);
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** Strip a single ATX H1 line (`# Title`), not just the first character of the title. */
function stripLeadingH1(markdown: string): string {
  return stripFrontmatter(markdown).replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "").trim();
}

export function parseOutlineSummary(markdown: string): string | null {
  const body = stripFrontmatter(markdown);
  const summarySection = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##\s|\n#[^#]|$)/i);
  if (summarySection?.[1]?.trim()) return summarySection[1].trim();
  const afterH1 = body.replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "").trim();
  const firstBlock = afterH1.split(/\n\n+/)[0]?.trim();
  return firstBlock || null;
}

async function readDraftContent(modelRoot: string, relPath: string): Promise<string> {
  const draftPath = path.join(modelRoot, relPath, "draft.md");
  if (!existsSync(draftPath)) return "";
  return (await readFile(draftPath, "utf8")).trim();
}

async function readOutlineContent(modelRoot: string, relPath: string): Promise<string> {
  const outlinePath = path.join(modelRoot, relPath, "outline.md");
  if (!existsSync(outlinePath)) return "";
  return await readFile(outlinePath, "utf8");
}

async function composeFigureDraftBlock(
  modelRoot: string,
  childRel: string,
  childTitle: string,
  linkHref: string,
  depth: number,
): Promise<string> {
  const meta = await resolveFigureMetadata(modelRoot, childRel);
  const caption = meta?.caption?.trim() || meta?.summary?.trim() || "";
  const figureEmbed = `::figure[${childRel}]\n\n`;
  if (!caption) {
    return linkedHeadingBlock(depth, childTitle, linkHref, figureEmbed);
  }
  return draftHeadingBlock(depth, childTitle, linkHref, `${figureEmbed}${caption}`);
}

async function composeTableDraftBlock(
  modelRoot: string,
  childRel: string,
  childTitle: string,
  linkHref: string,
  depth: number,
): Promise<string> {
  const meta = await resolveTableMetadata(modelRoot, childRel);
  const caption = meta?.caption?.trim() || meta?.summary?.trim() || "";
  const tableEmbed = `[[${childRel}|${childTitle}]]\n\n`;
  if (!caption) {
    return linkedHeadingBlock(depth, childTitle, linkHref, tableEmbed);
  }
  return draftHeadingBlock(depth, childTitle, linkHref, `${tableEmbed}${caption}`);
}

async function composeDraftBlock(
  modelRoot: string,
  sectionRel: string,
  childRel: string,
  childTitle: string,
  linkHref: string,
  depth: number,
): Promise<string> {
  if (await isFigureDir(modelRoot, childRel)) {
    return composeFigureDraftBlock(modelRoot, childRel, childTitle, linkHref, depth);
  }

  if (await isTableDir(modelRoot, childRel)) {
    return composeTableDraftBlock(modelRoot, childRel, childTitle, linkHref, depth);
  }

  const unit = await isUnitDir(modelRoot, childRel);

  if (unit) {
    const draft = await readDraftContent(modelRoot, childRel);
    if (!draft) return "";
    return draftHeadingBlock(depth, childTitle, linkHref, stripLeadingH1(draft));
  }

  const inner: string[] = [];
  for (const grandchild of await orderedChildren(modelRoot, childRel)) {
    const grandRel = resolveChildPath(modelRoot, childRel, grandchild);
    if (!grandRel) continue;
    const grandData = await readIndexData(modelRoot, grandRel);
    const grandTitle = displayChildTitle(grandData.title, grandchild);
    const grandHref = `${path.posix.relative(sectionRel, grandRel)}/INDEX.md`;
    const block = await composeDraftBlock(
      modelRoot,
      sectionRel,
      grandRel,
      grandTitle,
      grandHref,
      depth + 1,
    );
    if (block) inner.push(block);
  }

  if (inner.length === 0) return "";
  return linkedHeadingBlock(depth, childTitle, linkHref, inner.join(""));
}

/** Build composed section outline (subsection summaries) and draft (stitched child drafts). */
export async function composeSectionView(
  modelRoot: string,
  dirRel: string,
): Promise<SectionComposeResult> {
  const indexData = await readIndexData(modelRoot, dirRel);
  const title = String(indexData.title ?? titleCase(path.posix.basename(dirRel)));
  const kind = typeof indexData.kind === "string" ? indexData.kind : null;
  const isPaper = kind === "paper";

  const ownOutline = await readOutlineContent(modelRoot, dirRel);
  const ownSummary = parseOutlineSummary(ownOutline);

  const children: SectionChild[] = [];
  const outlineParts: string[] = [`# ${title}\n`];
  const draftParts: string[] = [`# ${title}\n\n`];

  if (ownSummary) {
    outlineParts.push(`## Summary\n\n${ownSummary}\n\n`);
    if (isPaper) {
      draftParts.push(`${ownSummary}\n\n`);
    }
  }

  outlineParts.push(`## ${isPaper ? "Sections" : "Subsections"}\n\n`);

  for (const childName of await orderedChildren(modelRoot, dirRel)) {
    const childRel = resolveChildPath(modelRoot, dirRel, childName);
    if (!childRel) continue;

    const childIndex = await readIndexData(modelRoot, childRel);
    const childTitle = displayChildTitle(childIndex.title, childName);
    const figure = await isFigureDir(modelRoot, childRel);
    const table = figure ? false : await isTableDir(modelRoot, childRel);
    const unit = figure || table ? false : await isUnitDir(modelRoot, childRel);
    const linkHref = `${childName}/INDEX.md`;

    const childOutline = await readOutlineContent(modelRoot, childRel);
    const childSummary = childOutline ? parseOutlineSummary(childOutline) : null;

    children.push({
      name: childName,
      path: childRel,
      title: childTitle,
      summary: childSummary,
      kind: figure ? "figure" : table ? "table" : unit ? "unit" : "section",
    });

    const assetBadge = figure ? " *(Figure)*" : table ? " *(Table)*" : "";
    outlineParts.push(linkedHeadingBlock(3, `${childTitle}${assetBadge}`, linkHref));
    outlineParts.push(childSummary ? `${childSummary}\n\n` : `*No summary yet — open to write.*\n\n`);

    const draftBlock = await composeDraftBlock(modelRoot, dirRel, childRel, childTitle, linkHref, 1);
    if (draftBlock) draftParts.push(draftBlock);
  }

  return {
    path: dirRel,
    title,
    kind,
    outlineMarkdown: outlineParts.join("").trim() + "\n",
    draftMarkdown: draftParts.join("").trim() + "\n",
    children,
  };
}
