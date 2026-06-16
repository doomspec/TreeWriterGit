import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

import { ModelFsError, resolveModelPath } from "./modelFs.js";

export interface CommentRecord {
  id: string;
  file: string;
  line: number;
  author: string;
  text: string;
  resolved: boolean;
  created_at: string;
  updated_at?: string;
}

function normalizeRel(relativePath: string): string {
  return relativePath.split(path.sep).join("/").replace(/^\.\//, "");
}

function assertMarkdownPath(filePath: string): string {
  const normalized = normalizeRel(filePath);
  if (!normalized.endsWith(".md")) {
    throw new ModelFsError("Comments attach to .md files only", 400);
  }
  return normalized;
}

/** Sidecar path relative to model root (see phase-2-paper-model). */
export function commentsSidecarRel(_modelRoot: string, fileRel: string): string {
  const normalized = assertMarkdownPath(fileRel);
  const match = normalized.match(/^papers\/([^/]+)\/sections\/(.+)$/);
  if (match) {
    return `papers/${match[1]}/sections/.comments/${match[2]}.comments.json`;
  }
  return `.comments/${normalized}.comments.json`;
}

function sidecarAbs(modelRoot: string, fileRel: string): string {
  const normalized = assertMarkdownPath(fileRel);
  resolveModelPath(modelRoot, normalized);
  return path.join(modelRoot, commentsSidecarRel(modelRoot, normalized));
}

async function readSidecar(abs: string): Promise<CommentRecord[]> {
  if (!existsSync(abs)) return [];
  try {
    const raw = await readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as CommentRecord[];
  } catch {
    return [];
  }
}

async function writeSidecar(abs: string, comments: CommentRecord[]): Promise<void> {
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(comments, null, 2)}\n`, "utf8");
}

export async function listComments(modelRoot: string, fileRel: string): Promise<CommentRecord[]> {
  const normalized = assertMarkdownPath(fileRel);
  return readSidecar(sidecarAbs(modelRoot, normalized));
}

export async function createComment(
  modelRoot: string,
  fileRel: string,
  input: { line: number; author: string; text: string },
): Promise<CommentRecord> {
  const normalized = assertMarkdownPath(fileRel);
  if (!input.text?.trim()) throw new ModelFsError("Comment text required", 400);
  if (!input.author?.trim()) throw new ModelFsError("Author required", 400);
  const line = Math.max(1, Math.floor(Number(input.line) || 1));
  const abs = sidecarAbs(modelRoot, normalized);
  const comments = await readSidecar(abs);
  const record: CommentRecord = {
    id: randomUUID().slice(0, 8),
    file: normalized,
    line,
    author: input.author.trim(),
    text: input.text.trim(),
    resolved: false,
    created_at: new Date().toISOString(),
  };
  comments.push(record);
  await writeSidecar(abs, comments);
  return record;
}

export async function updateComment(
  modelRoot: string,
  fileRel: string,
  id: string,
  patch: { text?: string; resolved?: boolean },
): Promise<CommentRecord> {
  const normalized = assertMarkdownPath(fileRel);
  const abs = sidecarAbs(modelRoot, normalized);
  const comments = await readSidecar(abs);
  const idx = comments.findIndex((c) => c.id === id);
  if (idx < 0) throw new ModelFsError("Comment not found", 404);
  const current = { ...comments[idx] };
  if (patch.text !== undefined) {
    if (!patch.text.trim()) throw new ModelFsError("Comment text required", 400);
    current.text = patch.text.trim();
  }
  if (patch.resolved !== undefined) current.resolved = patch.resolved;
  current.updated_at = new Date().toISOString();
  comments[idx] = current;
  await writeSidecar(abs, comments);
  return current;
}

export async function deleteComment(
  modelRoot: string,
  fileRel: string,
  id: string,
): Promise<void> {
  const normalized = assertMarkdownPath(fileRel);
  const abs = sidecarAbs(modelRoot, normalized);
  const comments = await readSidecar(abs);
  const filtered = comments.filter((c) => c.id !== id);
  if (filtered.length === comments.length) throw new ModelFsError("Comment not found", 404);
  await writeSidecar(abs, filtered);
}

export async function summarizeCommentsForPaper(
  modelRoot: string,
  paperSlug: string,
): Promise<{ unresolved: number; total: number }> {
  const slug = paperSlug.trim();
  if (!slug || slug.includes("/") || slug.includes("..")) {
    throw new ModelFsError("Invalid paper slug", 400);
  }
  resolveModelPath(modelRoot, `papers/${slug}`);

  let unresolved = 0;
  let total = 0;

  async function walkCommentsDir(dir: string): Promise<void> {
    if (!existsSync(dir)) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkCommentsDir(full);
      } else if (entry.name.endsWith(".comments.json")) {
        const items = await readSidecar(full);
        total += items.length;
        unresolved += items.filter((c) => !c.resolved).length;
      }
    }
  }

  await walkCommentsDir(path.join(modelRoot, "papers", slug, "sections", ".comments"));
  return { unresolved, total };
}
