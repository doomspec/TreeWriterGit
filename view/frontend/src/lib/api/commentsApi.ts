import { request } from "@/lib/apiClient";
import type { CommentAssignee, CommentRecord, CommentSummary } from "@treewriter/shared";

export type { CommentAssignee, CommentRecord, CommentSummary };

export function fetchCommentSummary(paperSlug: string) {
  return request<CommentSummary>(
    `/api/comments/summary?paperSlug=${encodeURIComponent(paperSlug)}`,
  );
}

export function fetchAssignedComments(
  paperSlug: string,
  filter?: { assigneeId?: string; assigneeType?: CommentAssignee["type"] },
) {
  const params = new URLSearchParams({ paperSlug });
  if (filter?.assigneeId) params.set("assigneeId", filter.assigneeId);
  if (filter?.assigneeType) params.set("assigneeType", filter.assigneeType);
  return request<{ comments: CommentRecord[] }>(`/api/comments/assigned?${params.toString()}`);
}

export function fetchComments(filePath: string) {
  return request<{ comments: CommentRecord[] }>(
    `/api/comments?path=${encodeURIComponent(filePath)}`,
  );
}

export function createComment(body: {
  path: string;
  line: number;
  author: string;
  text: string;
  assigned_to?: CommentAssignee | null;
  assigned_by?: string | null;
}) {
  return request<{ comment: CommentRecord }>("/api/comments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateComment(
  id: string,
  body: {
    path: string;
    text?: string;
    resolved?: boolean;
    assigned_to?: CommentAssignee | null;
    assigned_by?: string | null;
  },
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
