type LinkedBlock = {
  title: string;
  href: string;
  body: string;
};

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

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

export function isDuplicateComposedPreamble(preamble: string, firstBlockBody: string): boolean {
  const a = normalizeProse(preamble);
  const b = normalizeProse(firstBlockBody);
  if (!a || !b) return false;
  return a === b || b.includes(a) || a.includes(b);
}

export function stripDuplicateComposedPreamble(markdown: string, sectionTitle = "Section"): string {
  const { preamble, remainder } = extractPreambleBeforeLinkedHeadings(markdown);
  if (!preamble || !remainder) return markdown;
  const blocks = parseLinkedHeadingBlocks(`# ${sectionTitle}\n\n${remainder}`);
  if (blocks.length === 0) return markdown;
  if (!isDuplicateComposedPreamble(preamble, blocks[0].body)) return markdown;
  return `# ${sectionTitle}\n\n${remainder}\n`.trimEnd() + "\n";
}

/** Normalize composed section draft markdown from the section-compose API. */
export function normalizeComposedSectionDraft(
  sectionTitle: string,
  composedDraftMarkdown: string,
): string {
  const body = composedDraftMarkdown.replace(/^#\s+.+\n+/, "");
  return normalizeComposedDraftBody(body, sectionTitle);
}

/** Drop duplicate preamble and linked heading wrapper for single-unit section drafts. */
export function normalizeComposedDraftBody(body: string, sectionTitle = "Section"): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const withTitle = trimmed.startsWith("# ") ? trimmed : `# ${sectionTitle}\n\n${trimmed}\n`;
  let normalized = stripDuplicateComposedPreamble(withTitle, sectionTitle).replace(/^#\s+[^\n]+\n+/, "").trimEnd();
  const blocks = parseLinkedHeadingBlocks(`# ${sectionTitle}\n\n${normalized}\n`);
  if (blocks.length === 1 && blocks[0].body && !blocks[0].body.includes("\n## [")) {
    normalized = blocks[0].body;
  }
  return normalized;
}
