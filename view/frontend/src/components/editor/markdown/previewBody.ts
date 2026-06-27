import { stripFrontmatter } from "@/lib/modelTree";

export function parsePreviewBody(markdown: string) {
  const withoutFrontmatter = stripFrontmatter(markdown);
  const headingMatch = withoutFrontmatter.match(/^\s*#(?!#)\s+(.+?)\s*(?:\r?\n|$)/);
  if (!headingMatch) {
    return { title: null, body: withoutFrontmatter };
  }
  return {
    title: headingMatch[1],
    body: withoutFrontmatter.slice(headingMatch[0].length),
  };
}

export function splitForPreviewEdit(full: string) {
  const fmMatch = full.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) {
    return { frontmatter: "", body: full, suffix: "" };
  }
  const frontmatter = fmMatch[0];
  const rest = full.slice(frontmatter.length);
  return { frontmatter, body: rest, suffix: "" };
}

export function mergePreviewEdit(frontmatter: string, body: string): string {
  return frontmatter ? `${frontmatter}${body}` : body;
}

/** 1-based line in full file where the preview-editable body begins. */
export function previewBodyStartLine(fullContent: string, previewBody: string): number {
  const trimmed = previewBody.trimStart();
  if (!trimmed) return 1;
  const start = fullContent.indexOf(trimmed);
  if (start < 0) return 1;
  return fullContent.slice(0, start).split("\n").length;
}

/** Map a line inside the preview editor to a line in the saved markdown file. */
export function lineInFullDocument(
  fullContent: string,
  previewBody: string,
  lineInPreview: number,
): number {
  return Math.max(1, previewBodyStartLine(fullContent, previewBody) + lineInPreview - 1);
}
