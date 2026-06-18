import { ApiError, getApiBaseUrl, request } from "@/lib/apiClient";
import type { ModelNode } from "@/lib/modelTree";

export { ApiError, getApiBaseUrl, request };

export type NodeKind = "section" | "subsection" | "unit" | "figure" | "table" | "equation";

export function createNode(parent: string, name: string, kind: NodeKind) {
  return request<{ ok: true; path: string; kind: NodeKind }>("/api/model/node", {
    method: "POST",
    body: JSON.stringify({ parent, name, kind })
  });
}

export function createFile(path: string, content = "") {
  return request<{ ok: true; path: string }>("/api/model/file", {
    method: "POST",
    body: JSON.stringify({ path, content })
  });
}

export function deleteNode(path: string, recursive = false) {
  const query = recursive ? "&recursive=true" : "";
  return request<{ ok: true; path: string }>(
    `/api/model/file?path=${encodeURIComponent(path)}${query}`,
    { method: "DELETE" }
  );
}

export type TrashedItem = {
  id: string;
  trashPath: string;
  originalPath: string;
  originalParent: string;
  label: string;
  deletedAt: string;
};

export function archiveNode(path: string) {
  return request<{ ok: true; item: TrashedItem }>("/api/model/archive", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export function fetchTrashedItems(paperPath: string) {
  return request<{ items: TrashedItem[] }>(
    `/api/model/trash?paper=${encodeURIComponent(paperPath)}`,
  );
}

export function restoreTrashedItem(paperPath: string, itemId: string) {
  return request<{ ok: true; item: TrashedItem }>("/api/model/trash/restore", {
    method: "POST",
    body: JSON.stringify({ paper: paperPath, itemId }),
  });
}

export function purgeTrashedItem(paperPath: string, itemId: string) {
  return request<{ ok: true; item: TrashedItem }>(
    `/api/model/trash?paper=${encodeURIComponent(paperPath)}&itemId=${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
}

export function moveNode(from: string, to: string) {
  return request<{ ok: true; from: string; to: string }>("/api/model/move", {
    method: "POST",
    body: JSON.stringify({ from, to })
  });
}

export function reorderChildren(parent: string, childOrder: string[]) {
  return request<{ ok: true; parent: string }>("/api/model/reorder", {
    method: "POST",
    body: JSON.stringify({ parent, child_order: childOrder })
  });
}

export interface UnitStatusCounts {
  approved: number;
  drafted: number;
  outline: number;
  total: number;
}

export interface PaperSummary {
  slug: string;
  path: string;
  title: string;
  journal: string;
  status: string;
  lastExport: string | null;
  counts: UnitStatusCounts;
}

export interface SectionRollup {
  path: string;
  title: string;
  counts: UnitStatusCounts;
}

export interface PaperDetail extends PaperSummary {
  sections: SectionRollup[];
  containerCounts: Record<string, UnitStatusCounts>;
}

export function fetchPapers() {
  return request<{ papers: PaperSummary[] }>("/api/papers");
}

export function fetchPaperDetail(slug: string) {
  return request<{ paper: PaperDetail }>(`/api/papers?slug=${encodeURIComponent(slug)}`);
}

export function fetchJournalTemplates() {
  return request<{ journals: string[] }>("/api/paper/templates");
}

export function createPaper(body: {
  title: string;
  journal: string;
  authors: string[];
  slug?: string;
}) {
  return request<{ ok: true; slug: string; path: string }>("/api/paper", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function exportPaper(body: {
  paperSlug: string;
  format: "latex" | "pdf";
  includeDrafts?: boolean;
}) {
  return request<{
    path: string;
    downloadUrl: string;
    format: string;
    notice?: string;
    missingCitations?: string[];
    cslPath?: string;
  }>("/api/export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function exportPaperBatch(body: {
  paperSlug: string;
  formats: ("latex" | "pdf")[];
  includeDrafts?: boolean;
}) {
  return request<{
    results: Array<{
      path: string;
      downloadUrl: string;
      format: string;
      notice?: string;
      missingCitations?: string[];
      cslPath?: string;
    }>;
  }>("/api/export/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function pushToOverleaf(body: { paperSlug: string; includeDrafts?: boolean }) {
  return request<{
    repoPath: string;
    committed: boolean;
    message: string;
    exportPath: string;
    missingCitations?: string[];
  }>("/api/overleaf/push", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface SearchHit {
  path: string;
  line: number;
  excerpt: string;
}

export function searchModel(q: string, root = "", limit = 50) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (root) params.set("root", root);
  return request<{ results: SearchHit[] }>(`/api/model/search?${params.toString()}`);
}

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

export function fetchComments(filePath: string) {
  return request<{ comments: CommentRecord[] }>(
    `/api/comments?path=${encodeURIComponent(filePath)}`,
  );
}

export function fetchCommentSummary(paperSlug: string) {
  return request<{ unresolved: number; total: number }>(
    `/api/comments/summary?paperSlug=${encodeURIComponent(paperSlug)}`,
  );
}

export function createComment(body: {
  path: string;
  line: number;
  author: string;
  text: string;
}) {
  return request<{ comment: CommentRecord }>("/api/comments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateComment(
  id: string,
  body: { path: string; text?: string; resolved?: boolean },
) {
  return request<{ comment: CommentRecord }>(`/api/comments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteComment(id: string, filePath: string) {
  return request<{ ok: true }>(
    `/api/comments/${encodeURIComponent(id)}?path=${encodeURIComponent(filePath)}`,
    { method: "DELETE" },
  );
}

export function claimPresence(filePath: string, user: string) {
  return request<{ ok: true }>("/api/presence/claim", {
    method: "POST",
    body: JSON.stringify({ path: filePath, user }),
  });
}

export function releasePresence(filePath: string, user: string) {
  return request<{ ok: true }>(
    `/api/presence/claim?path=${encodeURIComponent(filePath)}&user=${encodeURIComponent(user)}`,
    { method: "DELETE" },
  );
}

export function heartbeatPresence(filePath: string, user: string) {
  return request<{ ok: boolean }>("/api/presence/heartbeat", {
    method: "POST",
    body: JSON.stringify({ path: filePath, user }),
  });
}

export function fetchPresence(filePath: string) {
  return request<{ presence: { user: string; since: string } | null }>(
    `/api/presence?path=${encodeURIComponent(filePath)}`,
  );
}

export function importOverleafFeedback(paperSlug: string) {
  return request<{ imported: number; paths: string[] }>("/api/overleaf/import", {
    method: "POST",
    body: JSON.stringify({ paperSlug }),
  });
}

export interface ContextCandidate {
  path: string;
  label: string;
  category: string;
  defaultIncluded: boolean;
}

export function fetchContextFiles(unitPath: string, action: string) {
  const params = new URLSearchParams({ unitPath, action });
  return request<{ files: ContextCandidate[] }>(`/api/agent/context?${params.toString()}`);
}

export function fanOutDispatch(body: {
  sectionPath: string;
  action: string;
  provider: string;
  customPrompt?: string;
}) {
  return request<{
    units: Array<{ prompt: string; command: string; outputPath: string; sessionId?: string }>;
  }>("/api/agent/fan-out", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function syncSectionDraft(
  containerPath: string,
  draftMarkdown: string,
  options?: SaveModelFileOptions,
) {
  return request<{ updated: string[] }>("/api/model/section-draft-sync", {
    method: "POST",
    body: JSON.stringify({
      path: containerPath,
      draftMarkdown,
      editedBy: options?.editedBy,
      aiAssisted: options?.aiAssisted,
    }),
  });
}

export function fetchApprovedSectionCompose(containerPath: string) {
  return request<{ draftMarkdown: string }>(
    `/api/model/section-compose?path=${encodeURIComponent(containerPath)}&approvedOnly=true`,
  );
}

export async function fetchModelFile(path: string): Promise<{ content: string }> {
  return request<{ content: string }>(`/api/model/file?path=${encodeURIComponent(path)}`);
}

export type SaveModelFileOptions = {
  editedBy?: string | null;
  aiAssisted?: boolean;
};

export async function saveModelFile(
  path: string,
  content: string,
  options?: SaveModelFileOptions,
): Promise<void> {
  const body: Record<string, unknown> = { path, content };
  if (options?.editedBy !== undefined) body.editedBy = options.editedBy;
  if (options?.aiAssisted !== undefined) body.aiAssisted = options.aiAssisted;
  try {
    await request("/api/model/file", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      await request("/api/model/file", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return;
    }
    throw err;
  }
}

export type DraftEditMeta = {
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
};

const emptyDraftEditMeta = (): DraftEditMeta => ({
  editedBy: null,
  editedAt: null,
  aiAssisted: false,
  approvedBy: null,
  approvedAt: null,
});

export async function fetchDraftApprovalState(targetPath: string): Promise<{
  content: string;
  meta: DraftEditMeta;
}> {
  try {
    const data = await request<{ content?: string; meta?: Partial<DraftEditMeta> }>(
      `/api/model/draft-approved?path=${encodeURIComponent(targetPath)}`,
    );
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
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { content: "", meta: emptyDraftEditMeta() };
    }
    return { content: "", meta: emptyDraftEditMeta() };
  }
}

export async function approveDraft(path: string, approvedBy?: string | null): Promise<void> {
  await request("/api/model/draft-approve", {
    method: "POST",
    body: JSON.stringify({ path, approvedBy: approvedBy ?? null }),
  });
}

export async function discardDraft(path: string): Promise<void> {
  await request("/api/model/draft-discard", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export type SectionComposeView = {
  path: string;
  title: string;
  kind: string | null;
  outlineMarkdown: string;
  draftMarkdown: string;
  children: Array<{
    name: string;
    path: string;
    title: string;
    summary: string | null;
    kind: "unit" | "section" | "figure" | "table" | "equation";
  }>;
};

export type ModelGraphNode = {
  id: string;
  label: string;
  type: string;
  links: number;
};

export type ModelGraphEdge = {
  source: string;
  target: string;
  kind?: "outline" | "contains";
};

export function fetchModelTree() {
  return request<{ tree: ModelNode[] }>("/api/model/tree");
}

export function fetchSectionCompose(path: string) {
  return request<SectionComposeView>(`/api/model/section-compose?path=${encodeURIComponent(path)}`);
}

export function fetchModelGraph(root: string) {
  return request<{ nodes: ModelGraphNode[]; edges: ModelGraphEdge[] }>(
    `/api/model/graph?root=${encodeURIComponent(root)}`,
  );
}
