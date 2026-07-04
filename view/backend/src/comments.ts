import path from "node:path";
import { randomUUID } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import type { CommentAssignee, CommentRecord, CommentSummary } from "@treewriter/shared";

import { loadProviders } from "./agentDispatch/providers.js";
import {
  listInlineComments,
  removeInlineCommentById,
  renderInlineCommentTag,
  replaceInlineCommentById,
} from "./inlineComments.js";
import { ModelFsError, resolveModelPath, resolvePaperRel } from "./modelFs.js";

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

function serializeAssignee(assignee: CommentAssignee | null | undefined): string | undefined {
  if (!assignee) return undefined;
  return `${assignee.type}:${assignee.id}:${assignee.label}`;
}

function parseAssigneeAttr(value: string | null | undefined): CommentAssignee | null {
  if (!value) return null;
  const [type, id, ...labelParts] = value.split(":");
  const label = labelParts.join(":");
  if (type !== "human" && type !== "ai") return null;
  if (!id || !label) return null;
  return { type, id, label };
}

/** Parse assignee from API body; throws ModelFsError on invalid shape. */
export function parseCommentAssignee(value: unknown): CommentAssignee | null | undefined {
  if (value === undefined) return undefined;
  return normalizeAssignee(value);
}

function inlineCommentToRecord(
  fileRel: string,
  comment: ReturnType<typeof listInlineComments>[number],
  createdAtFallback?: string,
): CommentRecord | null {
  if (!comment.text.trim()) return null;
  const assignedTo = parseAssigneeAttr(comment.assigned_to);
  return {
    id: comment.id || randomUUID().slice(0, 8),
    file: fileRel,
    line: comment.line,
    author: comment.author || "unknown",
    text: comment.text,
    resolved: comment.resolved,
    created_at: createdAtFallback ?? new Date().toISOString(),
    assigned_to: assignedTo,
    assigned_by: comment.assigned_by,
    assigned_at: comment.assigned_at,
  };
}

function manuscriptAbs(modelRoot: string, fileRel: string): string {
  const normalized = assertMarkdownPath(fileRel);
  return resolveModelPath(modelRoot, normalized);
}

async function readManuscript(modelRoot: string, fileRel: string): Promise<string> {
  return readFile(manuscriptAbs(modelRoot, fileRel), "utf8");
}

async function writeManuscript(modelRoot: string, fileRel: string, content: string): Promise<void> {
  await writeFile(manuscriptAbs(modelRoot, fileRel), content, "utf8");
}

function insertCommentAtLine(markdown: string, line: number, tag: string): string {
  const lines = markdown.split("\n");
  const index = Math.max(0, Math.min(lines.length - 1, line - 1));
  const current = lines[index] ?? "";
  lines[index] = `${current} ${tag}`.trimEnd();
  return lines.join("\n");
}

function buildCommentTag(input: {
  id: string;
  author: string;
  text: string;
  resolved?: boolean;
  assigned_to?: CommentAssignee | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  created_at?: string;
}): string {
  return renderInlineCommentTag({
    id: input.id,
    author: input.author,
    text: input.text,
    resolved: input.resolved,
    assigned_to: serializeAssignee(input.assigned_to ?? null),
    assigned_by: input.assigned_by ?? undefined,
    assigned_at: input.assigned_at ?? input.created_at,
  });
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

/** Legacy sidecar path (read-only fallback during migration). */
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

async function readLegacySidecarComments(modelRoot: string, fileRel: string): Promise<CommentRecord[]> {
  const sidecarRel = commentsSidecarRel(modelRoot, fileRel);
  const abs = path.join(modelRoot, sidecarRel);
  if (!existsSync(abs)) return [];
  try {
    const raw = await readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is CommentRecord => Boolean(entry && typeof entry === "object"));
  } catch {
    return [];
  }
}

export async function listComments(modelRoot: string, fileRel: string): Promise<CommentRecord[]> {
  const normalized = assertMarkdownPath(fileRel);
  const abs = manuscriptAbs(modelRoot, normalized);
  if (existsSync(abs)) {
    const markdown = await readFile(abs, "utf8");
    const inline = listInlineComments(markdown, normalized)
      .map((comment) => inlineCommentToRecord(normalized, comment))
      .filter((entry): entry is CommentRecord => entry !== null);
    if (inline.length > 0) return inline;
  }
  return readLegacySidecarComments(modelRoot, normalized);
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
  const now = new Date().toISOString();
  const id = randomUUID().slice(0, 8);
  const tag = buildCommentTag({
    id,
    author: input.author.trim(),
    text: input.text.trim(),
    assigned_to: assignedTo,
    assigned_by: input.assigned_by?.trim() || input.author.trim(),
    assigned_at: assignedTo ? now : null,
    created_at: now,
  });
  const markdown = await readManuscript(modelRoot, normalized);
  const updated = insertCommentAtLine(markdown, line, tag);
  await writeManuscript(modelRoot, normalized, updated);
  return {
    id,
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
  const markdown = await readManuscript(modelRoot, normalized);
  const existing = listInlineComments(markdown, normalized).find((comment) => comment.id === id);
  if (!existing) throw new ModelFsError("Comment not found", 404);

  const text = patch.text !== undefined ? patch.text.trim() : existing.text;
  if (!text) throw new ModelFsError("Comment text required", 400);
  const resolved = patch.resolved !== undefined ? patch.resolved : existing.resolved;
  let assignedTo = parseAssigneeAttr(existing.assigned_to);
  let assignedBy = existing.assigned_by;
  let assignedAt = existing.assigned_at;
  if (patch.assigned_to !== undefined) {
    assignedTo = normalizeAssignee(patch.assigned_to);
    await validateAssigneeForWrite(assignedTo, options?.repoRoot);
    if (assignedTo) {
      assignedBy = patch.assigned_by?.trim() || existing.author || null;
      assignedAt = new Date().toISOString();
    } else {
      assignedBy = null;
      assignedAt = null;
    }
  }

  const nextTag = buildCommentTag({
    id,
    author: existing.author || "unknown",
    text,
    resolved,
    assigned_to: assignedTo,
    assigned_by: assignedBy,
    assigned_at: assignedAt ?? undefined,
    created_at: assignedAt ?? undefined,
  });
  const updatedMarkdown = replaceInlineCommentById(markdown, id, nextTag);
  if (!updatedMarkdown) throw new ModelFsError("Comment not found", 404);
  await writeManuscript(modelRoot, normalized, updatedMarkdown);

  const record = inlineCommentToRecord(
    normalized,
    listInlineComments(updatedMarkdown, normalized).find((comment) => comment.id === id)!,
    assignedAt ?? undefined,
  );
  if (!record) throw new ModelFsError("Comment not found", 404);
  return record;
}

export async function deleteComment(
  modelRoot: string,
  fileRel: string,
  id: string,
): Promise<void> {
  const normalized = assertMarkdownPath(fileRel);
  const markdown = await readManuscript(modelRoot, normalized);
  const updated = removeInlineCommentById(markdown, id);
  if (!updated) throw new ModelFsError("Comment not found", 404);
  await writeManuscript(modelRoot, normalized, updated.replace(/[ \t]+\n/g, "\n"));
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

async function walkPaperMarkdownFiles(
  modelRoot: string,
  slug: string,
  visit: (fileRel: string, markdown: string) => void,
): Promise<void> {
  async function walkDir(dirRel: string): Promise<void> {
    const abs = path.join(modelRoot, dirRel);
    if (!existsSync(abs)) return;
    const entries = await readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const childRel = `${dirRel}/${entry.name}`;
      if (entry.isDirectory()) {
        await walkDir(childRel);
      } else if (entry.name.endsWith(".md") && entry.name !== "INDEX.md") {
        visit(childRel, await readFile(path.join(modelRoot, childRel), "utf8"));
      }
    }
  }
  await walkDir(`papers/${slug}`);
}

export async function summarizeCommentsForPaper(
  modelRoot: string,
  paperSlug: string,
): Promise<CommentSummary> {
  const paperRel = resolvePaperRel(modelRoot, paperSlug);
  const slug = paperRel.slice("papers/".length);

  const totals = { unresolved: 0, total: 0, assigned: 0, assignedUnresolved: 0 };
  await walkPaperMarkdownFiles(modelRoot, slug, (fileRel, markdown) => {
    const inline = listInlineComments(markdown, fileRel)
      .map((comment) => inlineCommentToRecord(fileRel, comment))
      .filter((entry): entry is CommentRecord => entry !== null);
    const partial = summarizeCommentList(inline);
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
  const paperRel = resolvePaperRel(modelRoot, paperSlug);
  const slug = paperRel.slice("papers/".length);

  const results: CommentRecord[] = [];
  await walkPaperMarkdownFiles(modelRoot, slug, (fileRel, markdown) => {
    for (const comment of listInlineComments(markdown, fileRel)) {
      const record = inlineCommentToRecord(fileRel, comment);
      if (!record?.assigned_to) continue;
      if (filter?.assigneeType && record.assigned_to.type !== filter.assigneeType) continue;
      if (filter?.assigneeId && record.assigned_to.id !== filter.assigneeId) continue;
      results.push(record);
    }
  });
  return results.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.created_at.localeCompare(b.created_at),
  );
}

/** Migrate legacy JSON sidecar comments into inline tags on the manuscript. */
export async function migrateSidecarCommentsToInline(
  modelRoot: string,
  fileRel: string,
): Promise<{ migrated: number }> {
  const normalized = assertMarkdownPath(fileRel);
  const legacy = await readLegacySidecarComments(modelRoot, normalized);
  if (legacy.length === 0) return { migrated: 0 };
  let markdown = await readManuscript(modelRoot, normalized);
  let migrated = 0;
  for (const comment of legacy.sort((a, b) => a.line - b.line)) {
    const tag = buildCommentTag({
      id: comment.id,
      author: comment.author,
      text: comment.text,
      resolved: comment.resolved,
      assigned_to: comment.assigned_to ?? null,
      assigned_by: comment.assigned_by ?? null,
      assigned_at: comment.assigned_at ?? comment.created_at,
      created_at: comment.created_at,
    });
    markdown = insertCommentAtLine(markdown, comment.line, tag);
    migrated += 1;
  }
  await writeManuscript(modelRoot, normalized, markdown);
  return { migrated };
}
