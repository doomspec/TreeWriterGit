import { request } from "@/lib/apiClient";
import type { ExportPaperResult, OverleafPushResult, OverleafStatus } from "@treewriter/shared";

export function exportPaper(body: {
  paperSlug: string;
  format: "latex" | "pdf" | "docx";
  includeDrafts?: boolean;
}) {
  return request<ExportPaperResult>("/api/export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function exportPaperBatch(body: {
  paperSlug: string;
  formats: ("latex" | "pdf" | "docx")[];
  includeDrafts?: boolean;
}) {
  return request<{ results: ExportPaperResult[] }>("/api/export/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function pushToOverleaf(body: { paperSlug: string; includeDrafts?: boolean }) {
  return request<OverleafPushResult>("/api/overleaf/push", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchOverleafStatus(paperSlug: string) {
  return request<OverleafStatus>(
    `/api/overleaf/status?paperSlug=${encodeURIComponent(paperSlug)}`,
  );
}

export function connectOverleaf(body: {
  paperSlug: string;
  gitUrl: string;
  token?: string;
}) {
  return request<{
    repoPath: string;
    gitUrl: string;
    projectId: string;
    action: "cloned" | "pulled" | "linked";
    message: string;
  }>("/api/overleaf/connect", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function importOverleafFeedback(paperSlug: string) {
  return request<{ imported: number; paths: string[] }>("/api/overleaf/import", {
    method: "POST",
    body: JSON.stringify({ paperSlug }),
  });
}
