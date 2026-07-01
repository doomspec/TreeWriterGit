/** Inline review comments: <comment id="…" author="…" resolved="true">text</comment> */

export const INLINE_COMMENT_PATTERN =
  /<comment\b([^>]*)>([\s\S]*?)<\/comment>/gi;

const ATTR_PATTERN = /(\w+)="([^"]*)"/g;

export type InlineCommentAttrs = {
  id?: string;
  author?: string;
  resolved?: boolean;
  assigned_to?: string;
  assigned_by?: string;
  assigned_at?: string;
};

export function parseInlineCommentAttrs(raw: string): InlineCommentAttrs {
  const attrs: InlineCommentAttrs = {};
  const re = new RegExp(ATTR_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key === "id") attrs.id = value;
    else if (key === "author") attrs.author = value;
    else if (key === "resolved") attrs.resolved = value === "true";
    else if (key === "assigned_to") attrs.assigned_to = value;
    else if (key === "assigned_by") attrs.assigned_by = value;
    else if (key === "assigned_at") attrs.assigned_at = value;
  }
  return attrs;
}

export function serializeInlineCommentAttrs(attrs: InlineCommentAttrs): string {
  const parts: string[] = [];
  if (attrs.id) parts.push(`id="${attrs.id}"`);
  if (attrs.author) parts.push(`author="${escapeAttr(attrs.author)}"`);
  if (attrs.resolved) parts.push(`resolved="true"`);
  if (attrs.assigned_to) parts.push(`assigned_to="${escapeAttr(attrs.assigned_to)}"`);
  if (attrs.assigned_by) parts.push(`assigned_by="${escapeAttr(attrs.assigned_by)}"`);
  if (attrs.assigned_at) parts.push(`assigned_at="${escapeAttr(attrs.assigned_at)}"`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

export function stripInlineComments(markdown: string): string {
  return markdown
    .replace(INLINE_COMMENT_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export type ParsedInlineComment = {
  id: string;
  author: string;
  text: string;
  resolved: boolean;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  start: number;
  end: number;
  line: number;
};

export function lineNumberAtOffset(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split("\n").length;
}

export function listInlineComments(markdown: string, fileRel = ""): ParsedInlineComment[] {
  const comments: ParsedInlineComment[] = [];
  const re = new RegExp(INLINE_COMMENT_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const attrs = parseInlineCommentAttrs(match[1] ?? "");
    const text = match[2]?.trim() ?? "";
    if (!text) continue;
    const start = match.index;
    const end = start + match[0].length;
    comments.push({
      id: attrs.id ?? "",
      author: attrs.author ?? "",
      text,
      resolved: Boolean(attrs.resolved),
      assigned_to: attrs.assigned_to ?? null,
      assigned_by: attrs.assigned_by ?? null,
      assigned_at: attrs.assigned_at ?? null,
      start,
      end,
      line: lineNumberAtOffset(markdown, start),
    });
    void fileRel;
  }
  return comments;
}

export function renderInlineCommentTag(
  attrs: InlineCommentAttrs & { text: string },
): string {
  return `<comment${serializeInlineCommentAttrs(attrs)}>${attrs.text}</comment>`;
}

export function replaceInlineCommentById(
  markdown: string,
  id: string,
  nextTag: string,
): string | null {
  const re = new RegExp(INLINE_COMMENT_PATTERN.source, "gi");
  let found = false;
  const updated = markdown.replace(re, (full, attrRaw: string, body: string) => {
    const attrs = parseInlineCommentAttrs(attrRaw ?? "");
    if (attrs.id !== id) return full;
    found = true;
    void body;
    return nextTag;
  });
  return found ? updated : null;
}

export function removeInlineCommentById(markdown: string, id: string): string | null {
  return replaceInlineCommentById(markdown, id, "");
}
