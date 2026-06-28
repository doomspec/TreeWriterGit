import { previewBodyStartLine } from "@/components/editor/markdown/previewBody";
import type { CommentRecord } from "@treewriter/shared";

/** 1-based file line numbers with at least one unresolved comment. */
export function unresolvedCommentFileLines(comments: CommentRecord[]): Set<number> {
  const lines = new Set<number>();
  for (const comment of comments) {
    if (!comment.resolved) lines.add(comment.line);
  }
  return lines;
}

/** Map file line numbers to 1-based lines in the editor-visible text. */
export function editorCommentLines(
  fileLines: Set<number>,
  fullContent: string,
  editorText: string,
): Set<number> {
  if (fileLines.size === 0) return new Set();
  const bodyStartLine =
    editorText === fullContent ? 1 : previewBodyStartLine(fullContent, editorText);
  const bodyLineCount = Math.max(1, editorText.split("\n").length);
  const out = new Set<number>();
  for (const fileLine of fileLines) {
    const editorLine = fileLine - bodyStartLine + 1;
    if (editorLine >= 1 && editorLine <= bodyLineCount) {
      out.add(editorLine);
    }
  }
  return out;
}

export function fileLineToEditorLine(
  fileLine: number,
  fullContent: string,
  editorText: string,
): number | null {
  const bodyStartLine =
    editorText === fullContent ? 1 : previewBodyStartLine(fullContent, editorText);
  const bodyLineCount = Math.max(1, editorText.split("\n").length);
  const editorLine = fileLine - bodyStartLine + 1;
  if (editorLine < 1 || editorLine > bodyLineCount) return null;
  return editorLine;
}

export function blockLineRanges(
  blocks: Array<{ id: string; markdown: string }>,
): Map<string, { start: number; end: number }> {
  const ranges = new Map<string, { start: number; end: number }>();
  let line = 1;
  for (const block of blocks) {
    const text = block.markdown.trimEnd();
    if (!text) continue;
    const lineCount = text.split("\n").length;
    ranges.set(block.id, { start: line, end: line + lineCount - 1 });
    line += lineCount + 1;
  }
  return ranges;
}

export function blockTouchesCommentLine(
  range: { start: number; end: number } | undefined,
  commentLines: Set<number>,
  activeCommentLine: number | null,
): "active" | "comment" | null {
  if (!range || commentLines.size === 0) return null;
  if (activeCommentLine != null && activeCommentLine >= range.start && activeCommentLine <= range.end) {
    return "active";
  }
  for (const commentLine of commentLines) {
    if (commentLine >= range.start && commentLine <= range.end) return "comment";
  }
  return null;
}
