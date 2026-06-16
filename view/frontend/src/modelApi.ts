const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type NodeKind = "section" | "subsection" | "unit";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("<")) {
      throw new ApiError(
        `API returned HTML instead of JSON (${response.status}). Is the backend running at ${apiBaseUrl}?`,
        response.status,
      );
    }
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(`Invalid JSON from API (${response.status})`, response.status);
    }
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

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
  }>("/api/export", {
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
