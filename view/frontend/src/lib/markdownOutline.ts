/** Extract document headings for outline navigation. */

export type MarkdownHeading = {
  id: string;
  level: number;
  text: string;
  lineIndex: number;
  /** Internal link target for outline list items and linked headings. */
  href?: string;
};

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const ATX_HEADING = /^(#{1,6})\s+(.+)$/;
const LINKED_HEADING = /^(#{1,6})\s+\[([^\]]+)\]\(([^)]+)\)\s*$/;
const LIST_LINK = /^(\s*)([-*+]|\d+\.)\s+\[([^\]]+)\]\(([^)]+)\)\s*$/;
const OUTLINE_SECTION_TITLE = /^(outline|sections|subsections)$/i;
const OUTLINE_META_HEADING = /^(summary|outline|sections|subsections|notes)$/i;
const COMPOSED_DRAFT_MAX_LEVEL = 3;

function slugify(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "section";
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER, "");
}

function nextHeadingId(text: string, slugCounts: Map<string, number>, prefix = "heading"): string {
  const baseSlug = slugify(text);
  const count = slugCounts.get(baseSlug) ?? 0;
  slugCounts.set(baseSlug, count + 1);
  return count === 0 ? `${prefix}-${baseSlug}` : `${prefix}-${baseSlug}-${count + 1}`;
}

function parseHeadingText(line: string): { level: number; text: string; href?: string } | null {
  const linked = LINKED_HEADING.exec(line.trim());
  if (linked) {
    return { level: linked[1].length, text: linked[2].trim(), href: linked[3].trim() };
  }
  const atx = ATX_HEADING.exec(line.trim());
  if (!atx) return null;
  return { level: atx[1].length, text: atx[2].replace(/\s+#+\s*$/, "").trim() };
}

function isOutlineSectionHeading(text: string): boolean {
  return OUTLINE_SECTION_TITLE.test(text.trim());
}

function pushHeading(
  headings: MarkdownHeading[],
  slugCounts: Map<string, number>,
  parsed: { level: number; text: string; href?: string },
  lineIndex: number,
): void {
  if (!parsed.text) return;
  headings.push({
    id: nextHeadingId(parsed.text, slugCounts),
    level: parsed.level,
    text: parsed.text,
    lineIndex,
    href: parsed.href,
  });
}

function pushListLink(
  headings: MarkdownHeading[],
  slugCounts: Map<string, number>,
  text: string,
  href: string,
  level: number,
  lineIndex: number,
): void {
  headings.push({
    id: nextHeadingId(text, slugCounts, "outline-link"),
    level,
    text,
    lineIndex,
    href,
  });
}

/** Walk markdown lines, skipping fenced code blocks. */
export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const body = stripFrontmatter(markdown);
  const lines = body.split("\n");
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  let fenceOpen: string | null = null;
  let listBaseLevel: number | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fenceOpen === null) {
        fenceOpen = marker[0];
      } else if (marker[0] === fenceOpen) {
        fenceOpen = null;
      }
      continue;
    }
    if (fenceOpen !== null) continue;

    const parsed = parseHeadingText(line);
    if (parsed?.text) {
      pushHeading(headings, slugCounts, parsed, lineIndex);
      listBaseLevel = isOutlineSectionHeading(parsed.text) ? parsed.level + 1 : null;
      continue;
    }

    if (listBaseLevel === null) continue;

    const listMatch = LIST_LINK.exec(line);
    if (!listMatch) {
      if (line.trim() !== "") listBaseLevel = null;
      continue;
    }

    const indent = listMatch[1] ?? "";
    const text = listMatch[3].trim();
    const href = listMatch[4].trim();
    if (!text || !href) continue;

    const level = listBaseLevel + Math.floor(indent.replace(/\t/g, "  ").length / 2);
    pushListLink(headings, slugCounts, text, href, level, lineIndex);
  }

  return headings;
}

/** True when the outline has links or real section headings (not empty Summary/Outline stubs). */
export function hasNavigableOutlineEntries(headings: MarkdownHeading[]): boolean {
  return headings.some(
    (heading) => heading.href || (heading.level >= 2 && !OUTLINE_META_HEADING.test(heading.text)),
  );
}

/** Keep title, outline list links, and composed-draft section headings for the sidebar outline. */
export function filterDocumentOutlineHeadings(headings: MarkdownHeading[]): MarkdownHeading[] {
  const hasOutlineLinks = headings.some((heading) => heading.href);
  const hasSectionHeadings = headings.some(
    (heading) => heading.level >= 2 && !OUTLINE_META_HEADING.test(heading.text),
  );

  return headings.filter((heading) => {
    if (OUTLINE_META_HEADING.test(heading.text)) return false;
    if (heading.level === 1 || heading.href) return true;
    if (hasOutlineLinks || hasSectionHeadings) {
      return heading.level <= COMPOSED_DRAFT_MAX_LEVEL;
    }
    return false;
  });
}

/** Map block ids to stable heading ids for scroll targets. */
export function buildBlockHeadingIdMap(
  blocks: { id: string; markdown: string }[],
): Record<string, string> {
  const slugCounts = new Map<string, number>();
  const result: Record<string, string> = {};
  for (const block of blocks) {
    const firstLine = block.markdown.trimStart().split("\n")[0] ?? "";
    const id = headingIdFromLine(firstLine, slugCounts);
    if (id) result[block.id] = id;
  }
  return result;
}

export function headingIdFromLine(line: string, slugCounts: Map<string, number>): string | null {
  const parsed = parseHeadingText(line);
  if (!parsed) return null;
  return nextHeadingId(parsed.text, slugCounts);
}
