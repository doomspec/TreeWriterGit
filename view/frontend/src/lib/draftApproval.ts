import { isDraftPath, parentPath } from "@/lib/modelTree";
import { getGitHubHandle } from "@/lib/userIdentity";
import { fetchModelFile, saveModelFile, type SaveModelFileOptions } from "@/modelApi";

export type DraftPendingSource = "human" | "ai";

export type DraftEditMeta = {
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
};

export const DRAFT_APPROVED_DOC = "draft.approved.md";

const emptyDraftEditMeta = (): DraftEditMeta => ({
  editedBy: null,
  editedAt: null,
  aiAssisted: false,
  approvedBy: null,
  approvedAt: null,
});

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
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"}/api/model/draft-approved?path=${encodeURIComponent(targetPath)}`,
    );
    if (!response.ok) return { content: "", meta: emptyDraftEditMeta() };
    const data = (await response.json()) as { content?: string; meta?: Partial<DraftEditMeta> };
    return {
      content: data.content ?? "",
      meta: {
        editedBy: data.meta?.editedBy ?? null,
        editedAt: data.meta?.editedAt ?? null,
        aiAssisted: Boolean(data.meta?.aiAssisted),
        approvedBy: data.meta?.approvedBy ?? null,
        approvedAt: data.meta?.approvedAt ?? null,
      },
    };
  } catch {
    return { content: "", meta: emptyDraftEditMeta() };
  }
}

/** @deprecated Use loadDraftApprovalState */
export async function loadApprovedDraftContent(targetPath: string): Promise<string> {
  const { content } = await loadDraftApprovalState(targetPath);
  return content;
}

export async function approveDraftAtPath(path: string, approvedBy?: string | null): Promise<void> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
  const handle = approvedBy ?? (getGitHubHandle() || null);
  const response = await fetch(`${apiBaseUrl}/api/model/draft-approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, approvedBy: handle }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Approve failed (${response.status})`);
  }
}

export async function discardDraftAtPath(path: string): Promise<void> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${apiBaseUrl}/api/model/draft-discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Discard failed (${response.status})`);
  }
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
