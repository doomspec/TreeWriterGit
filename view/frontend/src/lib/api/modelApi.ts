import { ApiError, getApiBaseUrl, request } from "@/lib/apiClient";
import type { ModelNode } from "@/lib/modelTree";
import type {
  DraftEditMeta,
  ExportPaperResult,
  GitSyncState,
  OverleafPushResult,
  OverleafStatus,
  PaperDetail,
  PaperSummary,
  PresenceEntry,
  SectionRollup,
  UnitStatusCounts,
  DocxImportResult,
} from "@treewriter/shared";

export { ApiError, getApiBaseUrl, request };
export type {
  DraftEditMeta,
  ExportPaperResult,
  GitSyncState,
  OverleafPushResult,
  OverleafStatus,
  PaperDetail,
  PaperSummary,
  PresenceEntry,
  SectionRollup,
  UnitStatusCounts,
  DocxImportResult,
};

export {
  connectOverleaf,
  exportPaper,
  exportPaperBatch,
  fetchOverleafStatus,
  importOverleafFeedback,
  pushToOverleaf,
} from "./exportApi";

export { importDocxIntoPaper } from "./importApi";

export {
  claimPresence,
  fetchPresence,
  heartbeatPresence,
  releasePresence,
} from "./presenceApi";

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

export interface JournalTemplate {
  journal: string;
  targetWords: number;
  sectionOrder: string[];
}

export function fetchPapers() {
  return request<{ papers: PaperSummary[] }>("/api/papers");
}

export function fetchPaperDetail(slug: string) {
  return request<{ paper: PaperDetail }>(`/api/papers?slug=${encodeURIComponent(slug)}`);
}

export function fetchJournalTemplates() {
  return request<{ journals: string[]; templates: JournalTemplate[] }>("/api/paper/templates");
}

export function createPaper(body: {
  title: string;
  journal: string;
  authors: string[];
  slug?: string;
  targetWords?: number;
  sectionOrder?: string[];
  status?: string;
  overleafRepoPath?: string | null;
}) {
  return request<{ ok: true; slug: string; path: string }>("/api/paper", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function updatePaper(body: {
  slug: string;
  title: string;
  journal: string;
  authors: string[];
  targetWords?: number;
  sectionOrder?: string[];
  status?: string;
  overleafRepoPath?: string | null;
}) {
  return request<{ ok: true; slug: string; path: string }>("/api/paper", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deletePaper(slug: string) {
  return request<{ ok: true; slug: string; path: string }>(
    `/api/paper?slug=${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
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

export {
  createComment,
  deleteComment,
  fetchAssignedComments,
  fetchCommentSummary,
  fetchComments,
  updateComment,
  type CommentAssignee,
  type CommentRecord,
  type CommentSummary,
} from "./commentsApi";

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
      aiProvider: options?.aiProvider,
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
  aiProvider?: string | null;
};

export async function saveModelFile(
  path: string,
  content: string,
  options?: SaveModelFileOptions,
): Promise<void> {
  const body: Record<string, unknown> = { path, content };
  if (options?.editedBy !== undefined) body.editedBy = options.editedBy;
  if (options?.aiAssisted !== undefined) body.aiAssisted = options.aiAssisted;
  if (options?.aiProvider !== undefined) body.aiProvider = options.aiProvider;
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

const emptyDraftEditMeta = (): DraftEditMeta => ({
  editedBy: null,
  editedAt: null,
  aiAssisted: false,
  aiProvider: null,
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
        aiProvider: data.meta?.aiProvider ?? null,
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

export async function approveDraftChildren(
  sectionPath: string,
  approvedBy?: string | null,
): Promise<{ updated: string[] }> {
  return request<{ updated: string[] }>("/api/model/draft-approve-children", {
    method: "POST",
    body: JSON.stringify({ path: sectionPath, approvedBy: approvedBy ?? null }),
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
  approvedDraftMarkdown?: string;
  pendingAiProvider?: string | null;
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

export type FetchModelTreeOptions = {
  path?: string;
  depth?: number;
};

export type ModelTreeResponse = {
  root: string;
  treeVersion: number;
  tree: ModelNode[];
};

export function fetchModelTree(options: FetchModelTreeOptions = {}) {
  const params = new URLSearchParams();
  if (options.path) params.set("path", options.path);
  if (options.depth !== undefined) params.set("depth", String(options.depth));
  const query = params.toString();
  return request<ModelTreeResponse>(`/api/model/tree${query ? `?${query}` : ""}`);
}

export function fetchSectionCompose(path: string) {
  return request<SectionComposeView>(`/api/model/section-compose?path=${encodeURIComponent(path)}`);
}

export function fetchModelGraph(root: string) {
  return request<{ nodes: ModelGraphNode[]; edges: ModelGraphEdge[] }>(
    `/api/model/graph?root=${encodeURIComponent(root)}`,
  );
}
