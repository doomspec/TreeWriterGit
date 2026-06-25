import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

import type { CommentAssignee, CommentRecord, CommentSummary } from "@treewriter/shared";

import { loadProviders } from "./agentDispatch/providers.js";
import { ModelFsError, resolveModelPath } from "./modelFs.js";

export type { CommentAssignee, CommentRecord, CommentSummary };

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

function normalizeAssignee(value: unknown): CommentAssignee | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || value === null) {
    throw new ModelFsError("Invalid assignee", 400);
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  const id = String(record.id ?? "").trim();
  const label = String(record.label ?? "").trim();
  if (type !== "human" && type !== "ai") {
    throw new ModelFsError("Assignee type must be human or ai", 400);
  }
  if (!id || !label) {
    throw new ModelFsError("Assignee id and label required", 400);
  }
  return { type, id, label };
}

/** Parse assignee from API body; throws ModelFsError on invalid shape. */
export function parseCommentAssignee(value: unknown): CommentAssignee | null | undefined {
  if (value === undefined) return undefined;
  return normalizeAssignee(value);
}

function normalizeCommentRecord(raw: unknown): CommentRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = String(record.id ?? "").trim();
  const file = String(record.file ?? "").trim();
  const author = String(record.author ?? "").trim();
  const text = String(record.text ?? "").trim();
  const created_at = String(record.created_at ?? "").trim();
  if (!id || !file || !author || !text || !created_at) return null;
  const line = Math.max(1, Math.floor(Number(record.line) || 1));
  let assigned_to: CommentAssignee | null | undefined;
  if (record.assigned_to === null) {
    assigned_to = null;
  } else if (record.assigned_to !== undefined) {
    try {
      assigned_to = normalizeAssignee(record.assigned_to);
    } catch {
      assigned_to = undefined;
    }
  }
  return {
    id,
    file,
    line,
    author,
    text,
    resolved: Boolean(record.resolved),
    created_at,
    ...(record.updated_at ? { updated_at: String(record.updated_at) } : {}),
    ...(assigned_to !== undefined ? { assigned_to } : {}),
    ...(record.assigned_by != null ? { assigned_by: String(record.assigned_by) } : {}),
    ...(record.assigned_at != null ? { assigned_at: String(record.assigned_at) } : {}),
  };
}

export async function validateCommentAssignee(
  repoRoot: string,
  assignee: CommentAssignee | null,
): Promise<void> {
  if (!assignee) return;
  if (assignee.type === "human") return;
  const config = await loadProviders(repoRoot);
  const match = config.aiProviders.some(
    (provider: { name: string }) => provider.name === assignee.id,
  );
  if (!match) {
    throw new ModelFsError(`Unknown AI provider: ${assignee.id}`, 400);
  }
}

/** Sidecar path relative to model root (see phase-2-paper-model). */
export function commentsSidecarRel(_modelRoot: string, fileRel: string): string {
  const normalized = assertMarkdownPath(fileRel);
  const paperMatch = normalized.match(/^papers\/([^/]+)\/(.+)$/);
  if (paperMatch) {
    const [, slug, rest] = paperMatch;
    if (rest.startsWith("sections/")) {
      return `papers/${slug}/sections/.comments/${rest.slice("sections/".length)}.comments.json`;
    }
    return `papers/${slug}/.comments/${rest}.comments.json`;
  }
  return `.comments/${normalized}.comments.json`;
}

/** Legacy/alternate sidecar location when canonical path is empty. */
function alternateCommentsSidecarRel(fileRel: string, primaryRel: string): string | null {
  const normalized = assertMarkdownPath(fileRel);
  const paperMatch = normalized.match(/^papers\/([^/]+)\/(.+)$/);
  if (!paperMatch) return null;
  const [, slug, rest] = paperMatch;
  if (rest.startsWith("sections/")) {
    const flat = `papers/${slug}/.comments/${rest}.comments.json`;
    return flat === primaryRel ? null : flat;
  }
  const nested = `papers/${slug}/sections/.comments/${rest}.comments.json`;
  return nested === primaryRel ? null : nested;
}

function sidecarAbs(modelRoot: string, fileRel: string): string {
  const normalized = assertMarkdownPath(fileRel);
  resolveModelPath(modelRoot, normalized);
  return path.join(modelRoot, commentsSidecarRel(modelRoot, normalized));
}

function sidecarAbsFromRel(modelRoot: string, sidecarRel: string): string {
  return path.join(modelRoot, sidecarRel);
}

async function readSidecarAbs(abs: string): Promise<CommentRecord[]> {
  if (!existsSync(abs)) return [];
  try {
    const raw = await readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeCommentRecord(entry))
      .filter((entry): entry is CommentRecord => entry !== null);
  } catch {
    return [];
  }
}

async function readSidecarForFile(modelRoot: string, fileRel: string): Promise<CommentRecord[]> {
  const normalized = assertMarkdownPath(fileRel);
  const primaryRel = commentsSidecarRel(modelRoot, normalized);
  const fromPrimary = await readSidecarAbs(sidecarAbsFromRel(modelRoot, primaryRel));
  if (fromPrimary.length > 0) return fromPrimary;
  const alternateRel = alternateCommentsSidecarRel(normalized, primaryRel);
  if (!alternateRel) return [];
  return readSidecarAbs(sidecarAbsFromRel(modelRoot, alternateRel));
}

async function writeSidecar(abs: string, comments: CommentRecord[]): Promise<void> {
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(comments, null, 2)}\n`, "utf8");
}

async function validateAssigneeForWrite(
  assignee: CommentAssignee | null,
  repoRoot: string | undefined,
): Promise<void> {
  if (!assignee) return;
  if (!repoRoot) {
    if (assignee.type === "ai") {
      throw new ModelFsError("Cannot assign AI provider without server configuration", 400);
    }
    return;
  }
  await validateCommentAssignee(repoRoot, assignee);
}

export async function listComments(modelRoot: string, fileRel: string): Promise<CommentRecord[]> {
  return readSidecarForFile(modelRoot, fileRel);
}

export async function createComment(
  modelRoot: string,
  fileRel: string,
  input: {
    line: number;
    author: string;
    text: string;
    assigned_to?: CommentAssignee | null;
    assigned_by?: string | null;
  },
  options?: { repoRoot?: string },
): Promise<CommentRecord> {
  const normalized = assertMarkdownPath(fileRel);
  if (!input.text?.trim()) throw new ModelFsError("Comment text required", 400);
  if (!input.author?.trim()) throw new ModelFsError("Author required", 400);
  const line = Math.max(1, Math.floor(Number(input.line) || 1));
  const assignedTo = input.assigned_to === undefined ? null : normalizeAssignee(input.assigned_to);
  await validateAssigneeForWrite(assignedTo, options?.repoRoot);
  const abs = sidecarAbs(modelRoot, normalized);
  const comments = await readSidecarAbs(abs);
  const now = new Date().toISOString();
  const record: CommentRecord = {
    id: randomUUID().slice(0, 8),
    file: normalized,
    line,
    author: input.author.trim(),
    text: input.text.trim(),
    resolved: false,
    created_at: now,
    ...(assignedTo
      ? {
          assigned_to: assignedTo,
          assigned_by: input.assigned_by?.trim() || input.author.trim(),
          assigned_at: now,
        }
      : {}),
  };
  comments.push(record);
  await writeSidecar(abs, comments);
  return record;
}

export async function updateComment(
  modelRoot: string,
  fileRel: string,
  id: string,
  patch: {
    text?: string;
    resolved?: boolean;
    assigned_to?: CommentAssignee | null;
    assigned_by?: string | null;
  },
  options?: { repoRoot?: string },
): Promise<CommentRecord> {
  const normalized = assertMarkdownPath(fileRel);
  const abs = sidecarAbs(modelRoot, normalized);
  const comments = await readSidecarAbs(abs);
  const idx = comments.findIndex((c) => c.id === id);
  if (idx < 0) throw new ModelFsError("Comment not found", 404);
  const current = { ...comments[idx] };
  if (patch.text !== undefined) {
    if (!patch.text.trim()) throw new ModelFsError("Comment text required", 400);
    current.text = patch.text.trim();
  }
  if (patch.resolved !== undefined) current.resolved = patch.resolved;
  if (patch.assigned_to !== undefined) {
    const assignedTo = normalizeAssignee(patch.assigned_to);
    await validateAssigneeForWrite(assignedTo, options?.repoRoot);
    if (assignedTo) {
      current.assigned_to = assignedTo;
      current.assigned_by = patch.assigned_by?.trim() || current.assigned_by || current.author;
      current.assigned_at = new Date().toISOString();
    } else {
      current.assigned_to = null;
      current.assigned_by = null;
      current.assigned_at = null;
    }
  }
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
  const comments = await readSidecarAbs(abs);
  const filtered = comments.filter((c) => c.id !== id);
  if (filtered.length === comments.length) throw new ModelFsError("Comment not found", 404);
  await writeSidecar(abs, filtered);
}

function summarizeCommentList(items: CommentRecord[]): Pick<
  CommentSummary,
  "unresolved" | "total" | "assigned" | "assignedUnresolved"
> {
  let unresolved = 0;
  let total = 0;
  let assigned = 0;
  let assignedUnresolved = 0;
  for (const comment of items) {
    total += 1;
    const isUnresolved = !comment.resolved;
    if (isUnresolved) unresolved += 1;
    if (comment.assigned_to) {
      assigned += 1;
      if (isUnresolved) assignedUnresolved += 1;
    }
  }
  return { unresolved, total, assigned, assignedUnresolved };
}

async function walkPaperCommentSidecars(
  modelRoot: string,
  slug: string,
  visit: (records: CommentRecord[]) => void,
): Promise<void> {
  async function walkCommentsDir(dir: string): Promise<void> {
    if (!existsSync(dir)) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkCommentsDir(full);
      } else if (entry.name.endsWith(".comments.json")) {
        visit(await readSidecarAbs(full));
      }
    }
  }

  await walkCommentsDir(path.join(modelRoot, "papers", slug, "sections", ".comments"));
  await walkCommentsDir(path.join(modelRoot, "papers", slug, ".comments"));
}

export async function summarizeCommentsForPaper(
  modelRoot: string,
  paperSlug: string,
): Promise<CommentSummary> {
  const slug = paperSlug.trim();
  if (!slug || slug.includes("/") || slug.includes("..")) {
    throw new ModelFsError("Invalid paper slug", 400);
  }
  resolveModelPath(modelRoot, `papers/${slug}`);

  const totals = { unresolved: 0, total: 0, assigned: 0, assignedUnresolved: 0 };
  await walkPaperCommentSidecars(modelRoot, slug, (records) => {
    const partial = summarizeCommentList(records);
    totals.unresolved += partial.unresolved;
    totals.total += partial.total;
    totals.assigned += partial.assigned;
    totals.assignedUnresolved += partial.assignedUnresolved;
  });
  return totals;
}

export async function listAssignedCommentsForPaper(
  modelRoot: string,
  paperSlug: string,
  filter?: { assigneeId?: string; assigneeType?: CommentAssignee["type"] },
): Promise<CommentRecord[]> {
  const slug = paperSlug.trim();
  if (!slug || slug.includes("/") || slug.includes("..")) {
    throw new ModelFsError("Invalid paper slug", 400);
  }
  resolveModelPath(modelRoot, `papers/${slug}`);

  const results: CommentRecord[] = [];
  await walkPaperCommentSidecars(modelRoot, slug, (records) => {
    for (const comment of records) {
      if (!comment.assigned_to) continue;
      if (filter?.assigneeType && comment.assigned_to.type !== filter.assigneeType) continue;
      if (filter?.assigneeId && comment.assigned_to.id !== filter.assigneeId) continue;
      results.push(comment);
    }
  });
  return results.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.created_at.localeCompare(b.created_at),
  );
}
