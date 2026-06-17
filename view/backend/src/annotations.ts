import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

import { listComments, type CommentRecord } from "./comments.js";
import { resolveModelPath } from "./modelFs.js";

const INLINE_NOTE_PATTERN = /\\([a-zA-Z]{1,12})\{([^}]*)\}/g;

export type CommentAnnotation = {
  type: "comment";
  id: string;
  file: string;
  line: number;
  author: string;
  text: string;
  resolved: boolean;
};

export type InlineNoteAnnotation = {
  type: "inlineNote";
  file: string;
  line: number;
  author: string;
  text: string;
  charIndex: number;
};

export type AnnotationRecord = CommentAnnotation | InlineNoteAnnotation;

function normalizeRel(relativePath: string): string {
  return relativePath.split(path.sep).join("/").replace(/^\.\//, "");
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function listInlineNotesWithLines(
  markdown: string,
): Array<{ author: string; text: string; line: number; charIndex: number }> {
  const notes: Array<{ author: string; text: string; line: number; charIndex: number }> = [];
  const re = new RegExp(INLINE_NOTE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    notes.push({
      author: match[1],
      text: match[2],
      charIndex: match.index,
      line: lineAt(markdown, match.index),
    });
  }
  return notes;
}

async function walkMarkdownFiles(
  absDir: string,
  relPrefix: string,
  acc: string[],
): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdownFiles(full, rel, acc);
    } else if (entry.name.endsWith(".md")) {
      acc.push(rel);
    }
  }
}

function compareAnnotations(a: AnnotationRecord, b: AnnotationRecord): number {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  if (a.line !== b.line) return a.line - b.line;
  if (a.type !== b.type) return a.type === "comment" ? -1 : 1;
  if (a.type === "comment" && b.type === "comment") {
    return a.id.localeCompare(b.id);
  }
  return 0;
}

function commentToAnnotation(comment: CommentRecord): CommentAnnotation {
  return {
    type: "comment",
    id: comment.id,
    file: comment.file.replace(/^\.\//, ""),
    line: comment.line,
    author: comment.author,
    text: comment.text,
    resolved: comment.resolved,
  };
}

export async function listAnnotationsUnderPath(
  modelRoot: string,
  folderRel: string,
): Promise<AnnotationRecord[]> {
  const prefix = normalizeRel(folderRel).replace(/\/$/, "");
  if (!prefix) {
    throw new Error("path required");
  }
  resolveModelPath(modelRoot, prefix);

  const mdFiles: string[] = [];
  await walkMarkdownFiles(path.join(modelRoot, prefix), prefix, mdFiles);

  const items: AnnotationRecord[] = [];

  for (const fileRel of mdFiles) {
    const comments = await listComments(modelRoot, fileRel);
    for (const comment of comments) {
      items.push(commentToAnnotation(comment));
    }

    const content = await readFile(path.join(modelRoot, fileRel), "utf8");
    for (const note of listInlineNotesWithLines(content)) {
      items.push({
        type: "inlineNote",
        file: fileRel,
        line: note.line,
        author: note.author,
        text: note.text,
        charIndex: note.charIndex,
      });
    }
  }

  items.sort(compareAnnotations);
  return items;
}

export async function summarizeAnnotationsUnderPath(
  modelRoot: string,
  folderRel: string,
): Promise<{
  commentsUnresolved: number;
  commentsTotal: number;
  inlineNotes: number;
  total: number;
}> {
  const items = await listAnnotationsUnderPath(modelRoot, folderRel);
  let commentsUnresolved = 0;
  let commentsTotal = 0;
  let inlineNotes = 0;
  for (const item of items) {
    if (item.type === "comment") {
      commentsTotal += 1;
      if (!item.resolved) commentsUnresolved += 1;
    } else {
      inlineNotes += 1;
    }
  }
  return {
    commentsUnresolved,
    commentsTotal,
    inlineNotes,
    total: items.length,
  };
}
