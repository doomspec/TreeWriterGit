import type { CommentAssignee, CommentRecord } from "@treewriter/shared";

import { getGitHubHandle, getUserName } from "@/lib/userIdentity";
import { fetchSettings } from "@/lib/settingsApi";

export type CommentAssigneeOption = CommentAssignee & { key: string };

export type CommentFilter = "all" | "mine" | "ai" | "unassigned";

export function currentUserAssigneeIds(): string[] {
  const ids = new Set<string>();
  const handle = getGitHubHandle()?.trim();
  const name = getUserName()?.trim();
  if (handle) ids.add(handle.replace(/^@/, "").toLowerCase());
  if (name) ids.add(name.toLowerCase());
  return [...ids];
}

export function commentAssignedToCurrentUser(comment: CommentRecord): boolean {
  if (!comment.assigned_to) return false;
  const target = comment.assigned_to.id.trim().toLowerCase();
  return currentUserAssigneeIds().some((id) => id === target);
}

export function matchesCommentFilter(comment: CommentRecord, filter: CommentFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unassigned") return !comment.assigned_to;
  if (filter === "ai") return comment.assigned_to?.type === "ai";
  if (filter === "mine") return commentAssignedToCurrentUser(comment);
  return true;
}

export function buildAssigneeOptions(
  comments: CommentRecord[],
  aiProviders: { name: string }[],
): CommentAssigneeOption[] {
  const options = new Map<string, CommentAssigneeOption>();

  const add = (assignee: CommentAssignee) => {
    const key = `${assignee.type}:${assignee.id}`;
    if (!options.has(key)) options.set(key, { ...assignee, key });
  };

  const handle = getGitHubHandle()?.trim();
  const name = getUserName()?.trim();
  if (handle) add({ type: "human", id: handle.replace(/^@/, ""), label: handle.startsWith("@") ? handle : `@${handle}` });
  if (name) add({ type: "human", id: name, label: name });

  for (const provider of aiProviders) {
    add({ type: "ai", id: provider.name, label: provider.name });
  }

  for (const comment of comments) {
    if (comment.assigned_to) add(comment.assigned_to);
    if (comment.author.trim()) {
      add({ type: "human", id: comment.author.trim(), label: comment.author.trim() });
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export async function loadAiProviderNames(): Promise<{ name: string }[]> {
  try {
    const settings = await fetchSettings();
    return settings.agents.aiProviders.map((provider) => ({ name: provider.name }));
  } catch {
    return [];
  }
}

/** Count unresolved assigned comments per folder path (longest-prefix match). */
export function assignedUnresolvedCountsByFolder(
  comments: CommentRecord[],
  folderPaths: string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const folderPath of folderPaths) counts.set(folderPath, 0);

  for (const comment of comments) {
    if (comment.resolved || !comment.assigned_to) continue;
    let best: string | null = null;
    for (const folderPath of folderPaths) {
      if (
        comment.file === folderPath ||
        comment.file.startsWith(`${folderPath}/`)
      ) {
        if (!best || folderPath.length > best.length) best = folderPath;
      }
    }
    if (best) counts.set(best, (counts.get(best) ?? 0) + 1);
  }

  return counts;
}
