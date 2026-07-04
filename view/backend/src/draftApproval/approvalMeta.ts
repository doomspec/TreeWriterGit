import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import type { DraftEditMeta, DraftSaveMeta } from "@treewriter/shared";

import { readIndexData } from "../modelFs.js";
import { manuscriptContentHash } from "./hash.js";
import {
  approvalMetaRel,
  legacyApprovedManuscriptRel,
  type ManuscriptKind,
} from "./paths.js";

export type ApprovalStatus = "approved" | "drafted" | "outline";

export type ApprovalMetaRecord = {
  contentHash: string | null;
  gitCommit: string | null;
  gitFileBlob: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvers: string[];
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  aiProvider: string | null;
  status: ApprovalStatus;
};

const META_FIELD_PREFIX: Record<ManuscriptKind, string> = {
  draft: "",
  outline: "outline_",
};

function emptyApprovalMeta(status: ApprovalStatus = "outline"): ApprovalMetaRecord {
  return {
    contentHash: null,
    gitCommit: null,
    gitFileBlob: null,
    approvedAt: null,
    approvedBy: null,
    approvers: [],
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    status,
  };
}

function metaField(data: Record<string, unknown>, kind: ManuscriptKind, field: string): unknown {
  return data[`${META_FIELD_PREFIX[kind]}${field}`];
}

export function normalizeGitHubHandle(handle: unknown): string | null {
  if (typeof handle !== "string") return null;
  const trimmed = handle.trim().replace(/^@+/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function parseApprovers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeGitHubHandle(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function parseApprovalStatus(value: unknown, fallback: ApprovalStatus): ApprovalStatus {
  if (value === "approved" || value === "drafted" || value === "outline") return value;
  return fallback;
}

function recordFromYaml(data: Record<string, unknown>): ApprovalMetaRecord {
  return {
    contentHash: typeof data.content_hash === "string" ? data.content_hash : null,
    gitCommit: typeof data.git_commit === "string" ? data.git_commit : null,
    gitFileBlob: typeof data.git_file_blob === "string" ? data.git_file_blob : null,
    approvedAt: typeof data.approved_at === "string" ? data.approved_at : null,
    approvedBy: normalizeGitHubHandle(data.approved_by),
    approvers: parseApprovers(data.approvers),
    editedBy: normalizeGitHubHandle(data.edited_by),
    editedAt: typeof data.edited_at === "string" ? data.edited_at : null,
    aiAssisted: Boolean(data.ai_assisted),
    aiProvider:
      typeof data.ai_provider === "string" && data.ai_provider.trim()
        ? data.ai_provider.trim()
        : null,
    status: parseApprovalStatus(data.status, "outline"),
  };
}

function recordFromIndex(data: Record<string, unknown>, kind: ManuscriptKind): ApprovalMetaRecord {
  const draftStatus = String(data.status ?? "outline");
  const status: ApprovalStatus =
    kind === "draft"
      ? parseApprovalStatus(draftStatus, "outline")
      : parseApprovalStatus(metaField(data, kind, "status"), draftStatus === "approved" ? "approved" : "outline");
  const approvedBy = normalizeGitHubHandle(metaField(data, kind, "approved_by"));
  return {
    contentHash: null,
    gitCommit: null,
    gitFileBlob: null,
    approvedAt:
      typeof metaField(data, kind, "approved_at") === "string"
        ? (metaField(data, kind, "approved_at") as string)
        : null,
    approvedBy,
    approvers: approvedBy ? [approvedBy] : [],
    editedBy: normalizeGitHubHandle(metaField(data, kind, "edited_by")),
    editedAt:
      typeof metaField(data, kind, "edited_at") === "string"
        ? (metaField(data, kind, "edited_at") as string)
        : null,
    aiAssisted: Boolean(metaField(data, kind, "ai_assisted")),
    aiProvider:
      typeof metaField(data, kind, "ai_provider") === "string" &&
      String(metaField(data, kind, "ai_provider")).trim()
        ? String(metaField(data, kind, "ai_provider")).trim()
        : null,
    status,
  };
}

function yamlFromRecord(record: ApprovalMetaRecord): Record<string, unknown> {
  return {
    content_hash: record.contentHash,
    git_commit: record.gitCommit,
    git_file_blob: record.gitFileBlob,
    approved_at: record.approvedAt,
    approved_by: record.approvedBy,
    approvers: record.approvers,
    edited_by: record.editedBy,
    edited_at: record.editedAt,
    ai_assisted: record.aiAssisted,
    ai_provider: record.aiProvider,
    status: record.status,
  };
}

export async function readApprovalMetaYaml(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
): Promise<ApprovalMetaRecord | null> {
  const abs = path.join(modelRoot, approvalMetaRel(unitRel, kind));
  if (!existsSync(abs)) return null;
  const raw = await readFile(abs, "utf8");
  const parsed = matter(`---\n${raw}\n---\n`);
  return recordFromYaml(parsed.data as Record<string, unknown>);
}

function yamlValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `\n${value.map((item) => `  - ${yamlValue(item)}`).join("\n")}`;
  }
  return JSON.stringify(String(value));
}

function dumpApprovalYaml(record: ApprovalMetaRecord): string {
  return `${Object.entries(yamlFromRecord(record))
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join("\n")}\n`;
}

export async function writeApprovalMetaYaml(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
  record: ApprovalMetaRecord,
): Promise<string> {
  const rel = approvalMetaRel(unitRel, kind);
  const abs = path.join(modelRoot, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, dumpApprovalYaml(record), "utf8");
  return rel;
}

export async function readManuscriptApprovalMeta(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
): Promise<ApprovalMetaRecord> {
  const fromYaml = await readApprovalMetaYaml(modelRoot, unitRel, kind);
  if (fromYaml) return fromYaml;
  const indexAbs = path.join(modelRoot, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) return emptyApprovalMeta();
  const data = await readIndexData(modelRoot, unitRel);
  return recordFromIndex(data, kind);
}

export function approvalMetaToDraftEditMeta(record: ApprovalMetaRecord): DraftEditMeta {
  return {
    editedBy: record.editedBy,
    editedAt: record.editedAt,
    aiAssisted: record.aiAssisted,
    aiProvider: record.aiProvider,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    contentHash: record.contentHash,
    gitCommit: record.gitCommit,
    approvers: record.approvers,
  };
}

export function indexPatchFromApprovalMeta(
  kind: ManuscriptKind,
  record: ApprovalMetaRecord,
): Record<string, unknown> {
  const prefix = META_FIELD_PREFIX[kind];
  const patch: Record<string, unknown> = {
    [`${prefix}edited_by`]: record.editedBy,
    [`${prefix}edited_at`]: record.editedAt,
    [`${prefix}ai_assisted`]: record.aiAssisted,
    [`${prefix}ai_provider`]: record.aiProvider,
    [`${prefix}approved_by`]: record.approvedBy,
    [`${prefix}approved_at`]: record.approvedAt,
  };
  if (kind === "draft") {
    patch.status = record.status;
  }
  return patch;
}

export function buildApprovedMetaRecord(input: {
  content: string;
  kind: ManuscriptKind;
  approvedBy?: string | null;
  gitCommit?: string | null;
  gitFileBlob?: string | null;
  previous?: ApprovalMetaRecord | null;
}): ApprovalMetaRecord {
  const approvedBy = normalizeGitHubHandle(input.approvedBy);
  const previousApprovers = input.previous?.approvers ?? [];
  const approvers =
    approvedBy && !previousApprovers.includes(approvedBy)
      ? [...previousApprovers, approvedBy]
      : previousApprovers.length > 0
        ? previousApprovers
        : approvedBy
          ? [approvedBy]
          : [];
  return {
    contentHash: manuscriptContentHash(input.content),
    gitCommit: input.gitCommit ?? null,
    gitFileBlob: input.gitFileBlob ?? null,
    approvedAt: new Date().toISOString(),
    approvedBy,
    approvers,
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    status: "approved",
  };
}

export function buildUnapprovedMetaPatch(
  kind: ManuscriptKind,
  previous: ApprovalMetaRecord,
  meta?: DraftSaveMeta,
): ApprovalMetaRecord {
  return {
    ...previous,
    editedAt: new Date().toISOString(),
    editedBy: meta?.editedBy !== undefined ? normalizeGitHubHandle(meta.editedBy) : previous.editedBy,
    aiAssisted: meta?.aiAssisted !== undefined ? meta.aiAssisted : previous.aiAssisted,
    aiProvider: meta?.aiProvider !== undefined ? meta.aiProvider ?? null : previous.aiProvider,
    status: kind === "draft" ? "drafted" : previous.status === "approved" ? "drafted" : previous.status,
  };
}

export function buildDiscardedMetaRecord(previous: ApprovalMetaRecord): ApprovalMetaRecord {
  return {
    ...previous,
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    status: "approved",
  };
}

export function hasLegacyApprovedBaseline(modelRoot: string, unitRel: string, kind: ManuscriptKind): boolean {
  return existsSync(path.join(modelRoot, legacyApprovedManuscriptRel(unitRel, kind)));
}
