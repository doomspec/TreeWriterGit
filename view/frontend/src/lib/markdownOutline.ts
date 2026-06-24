/** Extract document headings for outline navigation. */

export type MarkdownHeading = {
  id: string;
  level: number;
  text: string;
  lineIndex: number;
};

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const ATX_HEADING = /^(#{1,6})\s+(.+)$/;
const LINKED_HEADING = /^(#{2,6})\s+\[([^\]]+)\]\([^)]+\)\s*$/;

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

function parseHeadingText(line: string): { level: number; text: string } | null {
  const linked = LINKED_HEADING.exec(line.trim());
  if (linked) {
    return { level: linked[1].length, text: linked[2].trim() };
  }
  const atx = ATX_HEADING.exec(line.trim());
  if (!atx) return null;
  return { level: atx[1].length, text: atx[2].replace(/\s+#+\s*$/, "").trim() };
}

/** Walk markdown lines, skipping fenced code blocks. */
export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const body = stripFrontmatter(markdown);
  const lines = body.split("\n");
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  let fenceOpen: string | null = null;

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
    if (!parsed || !parsed.text) continue;

    const baseSlug = slugify(parsed.text);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const id = count === 0 ? `heading-${baseSlug}` : `heading-${baseSlug}-${count + 1}`;

    headings.push({
      id,
      level: parsed.level,
      text: parsed.text,
      lineIndex,
    });
  }

  return headings;
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
  const baseSlug = slugify(parsed.text);
  const count = slugCounts.get(baseSlug) ?? 0;
  slugCounts.set(baseSlug, count + 1);
  return count === 0 ? `heading-${baseSlug}` : `heading-${baseSlug}-${count + 1}`;
}
