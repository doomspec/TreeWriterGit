import { parseEmbedBlock } from "@/lib/embedBlocks";
import { joinMarkdownBlocks, splitMarkdownIntoBlocks } from "@/lib/markdownBlocks";

export const LINKED_HEADING_LINE_RE = /^#{2,4}\s+\[([^\]]+)\]\(([^)]+)\)\s*$/;

export type LinkedHeading = {
  title: string;
  href: string;
};

export type ComposedUnitSegment = {
  key: string;
  title: string;
  headingMarkdown: string | null;
  paragraphs: string[];
};

export function parseLinkedHeadingLine(line: string): LinkedHeading | null {
  const match = LINKED_HEADING_LINE_RE.exec(line.trim());
  if (!match) return null;
  return { title: match[1].trim(), href: match[2].trim() };
}

export function isLinkedHeadingLine(markdown: string): boolean {
  const firstLine = markdown.trim().split("\n")[0] ?? "";
  return LINKED_HEADING_LINE_RE.test(firstLine.trim());
}

export function titleCaseFromSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function buildLinkedHeadingMarkdown(slug: string, title = titleCaseFromSlug(slug)): string {
  return `## [${title}](${slug}/INDEX.md)`;
}

function splitProseParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Group composed draft body into logical units (linked heading + paragraph blocks). */
export function analyzeComposedDraftUnits(body: string): ComposedUnitSegment[] {
  const segments: ComposedUnitSegment[] = [];
  let current: ComposedUnitSegment | null = null;

  for (const block of splitMarkdownIntoBlocks(body)) {
    const markdown = block.markdown.trim();
    if (!markdown) continue;

    if (parseEmbedBlock(markdown)) continue;

    const linked = parseLinkedHeadingLine(markdown);
    if (linked && markdown.split("\n").length === 1) {
      current = {
        key: linked.href,
        title: linked.title,
        headingMarkdown: markdown,
        paragraphs: [],
      };
      segments.push(current);
      continue;
    }

    if (!current) {
      current = {
        key: "__preamble__",
        title: "Section text",
        headingMarkdown: null,
        paragraphs: [],
      };
      segments.push(current);
    }

    for (const paragraph of splitProseParagraphs(markdown)) {
      if (isLinkedHeadingLine(paragraph)) continue;
      current.paragraphs.push(paragraph);
    }
  }

  return segments;
}

export function findMultiParagraphUnits(body: string): ComposedUnitSegment[] {
  return analyzeComposedDraftUnits(body).filter((segment) => segment.paragraphs.length > 1);
}

export function insertMarkdownAfterBlock(
  markdown: string,
  afterBlockIndex: number,
  insertParts: string[],
): string {
  const parts = splitMarkdownIntoBlocks(markdown).map((block) => block.markdown);
  const insertAt = Math.max(0, Math.min(afterBlockIndex + 1, parts.length));
  const next = [...parts.slice(0, insertAt), ...insertParts, ...parts.slice(insertAt)];
  return joinMarkdownBlocks(
    next.filter((part) => part.trim().length > 0).map((part, index) => ({
      id: `insert-${index}`,
      markdown: part,
    })),
  );
}

export function combineMultiParagraphUnits(body: string): string {
  const parts: string[] = [];
  for (const segment of analyzeComposedDraftUnits(body)) {
    if (segment.headingMarkdown) parts.push(segment.headingMarkdown);
    if (segment.paragraphs.length > 0) {
      parts.push(segment.paragraphs.join(" "));
    }
  }
  return parts.join("\n\n").trimEnd();
}

function uniqueSlug(base: string, used: Set<string>): string {
  const normalized = base.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "unit";
  let candidate = normalized;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${normalized}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function slugFromParagraph(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  return words.join("-") || "unit";
}

/** Split extra paragraphs into new linked unit blocks (creates model nodes via callback). */
export async function splitMultiParagraphUnits(
  body: string,
  createUnit: (slug: string) => Promise<void>,
): Promise<string> {
  const usedSlugs = new Set<string>();
  const parts: string[] = [];

  for (const segment of analyzeComposedDraftUnits(body)) {
    if (segment.paragraphs.length <= 1) {
      if (segment.headingMarkdown) parts.push(segment.headingMarkdown);
      if (segment.paragraphs[0]) parts.push(segment.paragraphs[0]);
      continue;
    }

    if (segment.headingMarkdown) parts.push(segment.headingMarkdown);
    parts.push(segment.paragraphs[0]);

    for (let index = 1; index < segment.paragraphs.length; index += 1) {
      const paragraph = segment.paragraphs[index];
      const slug = uniqueSlug(slugFromParagraph(paragraph), usedSlugs);
      const unitTitle = titleCaseFromSlug(slug);
      await createUnit(slug);
      parts.push(buildLinkedHeadingMarkdown(slug, unitTitle));
      parts.push(paragraph);
    }
  }

  return parts.join("\n\n").trimEnd();
}

/** Folder slugs from linked headings in composed draft order (for INDEX child_order sync). */
export function childFolderSlugsFromComposedBody(body: string): string[] {
  const slugs: string[] = [];
  for (const segment of analyzeComposedDraftUnits(body)) {
    if (!segment.headingMarkdown) continue;
    const linked = parseLinkedHeadingLine(segment.headingMarkdown);
    if (!linked) continue;
    const normalized = linked.href.replace(/\\/g, "/").replace(/\/+$/, "");
    const slug = normalized.split("/").filter(Boolean)[0];
    if (slug) slugs.push(slug);
  }
  return slugs;
}
