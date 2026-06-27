export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export function parseFrontmatterStatus(markdown: string): string | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const statusMatch = match[1].match(/^status:\s*["']?([^"'\n]+)["']?\s*$/m);
  return statusMatch?.[1]?.trim() ?? null;
}

export type IndexMeta = {
  title: string | null;
  summary: string | null;
  composedAtCommit: string | null;
  childOrder: string[];
  kind: string | null;
};

function parseFrontmatterBlock(markdown: string): Record<string, string> | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (kv) {
      data[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return data;
}

function parseYamlList(markdown: string, key: string): string[] {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [];
  const lines = fm[1].split("\n");
  const items: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (line.match(new RegExp(`^${key}:\\s*$`))) {
      inList = true;
      continue;
    }
    if (inList) {
      const item = line.match(/^\s+-\s+["']?([^"'\n]+)["']?\s*$/);
      if (item) {
        items.push(item[1].trim());
        continue;
      }
      if (line.match(/^\S/)) break;
    }
  }
  return items;
}

export function parseIndexFrontmatter(markdown: string): IndexMeta {
  const fm = parseFrontmatterBlock(markdown);
  const body = stripFrontmatter(markdown);
  const headingMatch = body.match(/^\s*#(?!#)\s+(.+?)\s*(?:\r?\n|$)/);

  return {
    title: fm?.title ?? headingMatch?.[1]?.trim() ?? null,
    summary: fm?.summary ?? null,
    composedAtCommit: fm?.composed_at_commit ?? null,
    childOrder: parseYamlList(markdown, "child_order").length
      ? parseYamlList(markdown, "child_order")
      : parseYamlList(markdown, "section_order"),
    kind: fm?.kind ?? null,
  };
}

/** Plain paths from frontmatter `links:` (roboculture-style cross-references). */
export function parseFrontmatterLinks(markdown: string): string[] {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [];
  const lines = fm[1].split("\n");
  const items: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (line.match(/^links:\s*$/)) {
      inList = true;
      continue;
    }
    if (inList) {
      const item = line.match(/^\s+-\s+["']?([^"'\n]+)["']?\s*$/);
      if (item) {
        items.push(item[1].trim());
        continue;
      }
      if (line.match(/^\S/)) break;
    }
  }
  return items;
}
