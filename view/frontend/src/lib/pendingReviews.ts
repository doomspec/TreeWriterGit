import type { PendingReviewItem } from "@treewriter/shared";

import { formatPendingAuthorLabel } from "@/lib/draftApproval";

export type PendingReviewAuthorGroup = {
  authorKey: string;
  label: string;
  isAi: boolean;
  items: PendingReviewItem[];
};

const UNKNOWN_AUTHOR_KEY = "__unknown__";

export function authorKeyForReview(item: PendingReviewItem): string {
  if (item.aiAssisted) {
    return item.aiProvider?.trim() || "AI";
  }
  if (item.editedBy?.trim()) {
    return item.editedBy.trim().replace(/^@+/, "");
  }
  return UNKNOWN_AUTHOR_KEY;
}

export function authorLabelForReview(item: PendingReviewItem): string {
  return formatPendingAuthorLabel({
    pendingSource: item.aiAssisted ? "ai" : "human",
    editedBy: item.editedBy,
    aiAssisted: item.aiAssisted,
    aiProvider: item.aiProvider,
  });
}

export function isAiReviewAuthor(authorKey: string): boolean {
  return authorKey !== UNKNOWN_AUTHOR_KEY && authorKey !== "AI" ? true : authorKey === "AI";
}

export function groupPendingReviewsByAuthor(items: PendingReviewItem[]): PendingReviewAuthorGroup[] {
  const groups = new Map<string, PendingReviewAuthorGroup>();

  for (const item of items) {
    const authorKey = authorKeyForReview(item);
    const existing = groups.get(authorKey);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(authorKey, {
      authorKey,
      label: authorLabelForReview(item),
      isAi: item.aiAssisted,
      items: [item],
    });
  }

  return [...groups.values()].sort((a, b) => {
    if (a.isAi !== b.isAi) return a.isAi ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

function placeholderReviewItem(path: string): PendingReviewItem {
  const kind = path.endsWith("/outline.md") ? "outline" : "draft";
  const unitPath = path.replace(/\/(draft|outline)\.md$/, "");
  const name = unitPath.split("/").pop() ?? unitPath;
  return {
    path,
    kind,
    unitPath,
    unitTitle: name,
    sectionPath: null,
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    changeSummary: { addedLines: 0, removedLines: 0, changedWords: 0 },
  };
}

/** Merge server pending reviews with editor-only pending paths (open dirty sessions). */
export function mergePendingReviews(
  serverItems: PendingReviewItem[],
  extraPaths: Iterable<string>,
): PendingReviewItem[] {
  const byPath = new Map(serverItems.map((item) => [item.path, item]));
  for (const pathValue of extraPaths) {
    const normalized = pathValue.replace(/\\/g, "/");
    if (!normalized || byPath.has(normalized)) continue;
    byPath.set(normalized, placeholderReviewItem(normalized));
  }
  return [...byPath.values()].sort((a, b) => {
    const aTime = a.editedAt ? Date.parse(a.editedAt) : 0;
    const bTime = b.editedAt ? Date.parse(b.editedAt) : 0;
    return bTime - aTime;
  });
}

export function formatReviewChangeSummary(item: PendingReviewItem): string {
  const { addedLines, removedLines } = item.changeSummary;
  if (addedLines === 0 && removedLines === 0) return "unsaved changes";
  const parts: string[] = [];
  if (addedLines > 0) parts.push(`+${addedLines}`);
  if (removedLines > 0) parts.push(`−${removedLines}`);
  return `${parts.join(" / ")} lines`;
}

export function authorGroupBorderColor(authorKey: string): string {
  let hash = 0;
  for (let index = 0; index < authorKey.length; index += 1) {
    hash = (hash * 31 + authorKey.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 55% 42%)`;
}
