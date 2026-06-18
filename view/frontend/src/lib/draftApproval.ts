import { isDraftPath, parentPath } from "@/lib/modelTree";
import { getGitHubHandle } from "@/lib/userIdentity";
import {
  approveDraft,
  discardDraft,
  fetchDraftApprovalState,
  fetchModelFile,
  saveModelFile,
  type DraftEditMeta,
  type SaveModelFileOptions,
} from "@/modelApi";

export type DraftPendingSource = "human" | "ai";

export type { DraftEditMeta };

export const DRAFT_APPROVED_DOC = "draft.approved.md";

export function requiresDraftApproval(filePath: string): boolean {
  return isDraftPath(filePath);
}

export function approvedDraftPathFor(filePath: string): string {
  const unitDir = isDraftPath(filePath) ? parentPath(filePath) : filePath;
  return `${unitDir}/${DRAFT_APPROVED_DOC}`;
}

export function unitDirFromDraftFile(filePath: string): string {
  return parentPath(filePath);
}

export function draftSaveMeta(pendingSource: DraftPendingSource | null): SaveModelFileOptions {
  const editedBy = getGitHubHandle() || null;
  return {
    editedBy,
    aiAssisted: pendingSource === "ai",
  };
}

export async function loadModelFileContent(filePath: string): Promise<string> {
  try {
    const { content } = await fetchModelFile(filePath);
    return content;
  } catch (err) {
    if (err instanceof Error && /404|not found/i.test(err.message)) return "";
    throw err;
  }
}

export async function loadDraftApprovalState(targetPath: string): Promise<{
  content: string;
  meta: DraftEditMeta;
}> {
  return fetchDraftApprovalState(targetPath);
}

/** @deprecated Use loadDraftApprovalState */
export async function loadApprovedDraftContent(targetPath: string): Promise<string> {
  const { content } = await loadDraftApprovalState(targetPath);
  return content;
}

export async function approveDraftAtPath(path: string, approvedBy?: string | null): Promise<void> {
  const handle = approvedBy ?? (getGitHubHandle() || null);
  await approveDraft(path, handle);
}

export async function discardDraftAtPath(path: string): Promise<void> {
  await discardDraft(path);
}

export function draftStatusLabel(options: {
  requiresApproval: boolean;
  isPendingApproval: boolean;
  isDirty: boolean;
  saveState: string;
  defaultLabel?: string;
}): string {
  const { requiresApproval, isPendingApproval, isDirty, saveState, defaultLabel = "saved" } = options;
  if (!requiresApproval) {
    if (saveState === "dirty" || isDirty) return "unsaved";
    if (saveState === "saving") return "saving…";
    if (saveState === "saved") return "saved";
    if (saveState === "error") return "error";
    return defaultLabel;
  }
  if (saveState === "saving") return isDirty ? "saving…" : "approving…";
  if (isPendingApproval && isDirty) return "saving…";
  if (isPendingApproval) return "saved · pending approval";
  if (saveState === "error") return "error";
  return "approved";
}

export function formatGitHubHandle(handle: string | null | undefined): string | null {
  if (!handle?.trim()) return null;
  return `@${normalizeGitHubHandle(handle)}`;
}

function normalizeGitHubHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export { saveModelFile };
