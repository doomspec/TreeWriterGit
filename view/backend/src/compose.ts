import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";

const SKIP_CHILDREN = new Set(["notes", ".sessions"]);

export type SectionChild = {
  name: string;
  path: string;
  title: string;
  summary: string | null;
  kind: "unit" | "section";
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

function draftHeadingBlock(
  depth: number,
  childTitle: string,
  linkHref: string,
  body: string,
): string {
  const heading = "#".repeat(Math.min(depth + 1, 4));
  return `${heading} ${childTitle}\n\n[Open ${childTitle} →](${linkHref})\n\n${body}\n\n`;
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function stripLeadingH1(markdown: string): string {
  return stripFrontmatter(markdown).replace(/^\s*#(?!#)\s+.+?\r?\n?/, "").trim();
}

export function parseOutlineSummary(markdown: string): string | null {
  const body = stripFrontmatter(markdown);
  const summarySection = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##\s|\n#[^#]|$)/i);
  if (summarySection?.[1]?.trim()) return summarySection[1].trim();
  const afterH1 = body.replace(/^\s*#(?!#)\s+.+?\r?\n?/, "").trim();
  const firstBlock = afterH1.split(/\n\n+/)[0]?.trim();
  return firstBlock || null;
}

async function readIndexData(modelRoot: string, relPath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(modelRoot, relPath, "INDEX.md"), "utf8");
    return matter(raw).data as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resolveChildPath(modelRoot: string, parentRel: string, childName: string): string | null {
  const direct = `${parentRel}/${childName}`;
  if (existsSync(path.join(modelRoot, direct))) return direct;
  const underSections = `${parentRel}/sections/${childName}`;
  if (existsSync(path.join(modelRoot, underSections))) return underSections;
  return null;
}

async function isUnitDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "unit") return true;
  if (data.kind === "section" || data.kind === "subsection" || data.kind === "paper") {
    return false;
  }
  return existsSync(path.join(modelRoot, relPath, "draft.md"));
}

async function orderedChildren(modelRoot: string, dirRel: string): Promise<string[]> {
  const data = await readIndexData(modelRoot, dirRel);
  const sectionOrder = Array.isArray(data.section_order) ? (data.section_order as string[]) : [];
  let childOrder = Array.isArray(data.child_order) ? (data.child_order as string[]) : [];

  const sectionsRoot = `${dirRel}/sections`;
  if (sectionOrder.length === 0 && existsSync(path.join(modelRoot, sectionsRoot))) {
    const sectionsData = await readIndexData(modelRoot, sectionsRoot);
    childOrder = Array.isArray(sectionsData.child_order)
      ? (sectionsData.child_order as string[])
      : childOrder;
  }

  const order = sectionOrder.length > 0 ? sectionOrder : childOrder;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of order) {
    if (SKIP_CHILDREN.has(name)) continue;
    if (!resolveChildPath(modelRoot, dirRel, name)) continue;
    seen.add(name);
    result.push(name);
  }

  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(path.join(modelRoot, dirRel), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_CHILDREN.has(entry.name) || seen.has(entry.name)) continue;
      if (entry.name === "sections" && order.length > 0) continue;
      result.push(entry.name);
    }
  } catch {
    // ignore
  }

  return result;
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

async function composeDraftBlock(
  modelRoot: string,
  sectionRel: string,
  childRel: string,
  childTitle: string,
  linkHref: string,
  depth: number,
): Promise<string> {
  const isUnit = await isUnitDir(modelRoot, childRel);
  const heading = "#".repeat(Math.min(depth + 1, 4));

  if (isUnit) {
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
  return `${heading} ${childTitle}\n\n[Open ${childTitle} →](${linkHref})\n\n${inner.join("")}`;
}

/** Build composed section outline (subsection summaries) and draft (stitched child drafts). */
export async function composeSectionView(
  modelRoot: string,
  dirRel: string,
): Promise<SectionComposeResult> {
  const indexData = await readIndexData(modelRoot, dirRel);
  const title = String(indexData.title ?? titleCase(path.posix.basename(dirRel)));
  const kind = typeof indexData.kind === "string" ? indexData.kind : null;

  const ownOutline = await readOutlineContent(modelRoot, dirRel);
  const ownSummary = parseOutlineSummary(ownOutline);

  const children: SectionChild[] = [];
  const outlineParts: string[] = [`# ${title}\n`];
  const draftParts: string[] = [`# ${title}\n\n`];

  if (ownSummary) {
    outlineParts.push(`## Summary\n\n${ownSummary}\n\n`);
  }

  outlineParts.push(`## Subsections\n\n`);

  for (const childName of await orderedChildren(modelRoot, dirRel)) {
    const childRel = resolveChildPath(modelRoot, dirRel, childName);
    if (!childRel) continue;

    const childIndex = await readIndexData(modelRoot, childRel);
    const childTitle = displayChildTitle(childIndex.title, childName);
    const isUnit = await isUnitDir(modelRoot, childRel);
    const linkHref = `${childName}/INDEX.md`;

    const childOutline = await readOutlineContent(modelRoot, childRel);
    const childSummary = childOutline ? parseOutlineSummary(childOutline) : null;

    children.push({
      name: childName,
      path: childRel,
      title: childTitle,
      summary: childSummary,
      kind: isUnit ? "unit" : "section",
    });

    outlineParts.push(`### ${childTitle}\n\n[Open ${childTitle} →](${linkHref})\n\n`);
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
