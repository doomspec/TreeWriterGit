import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { gitSyncHasError, type GitSyncState } from "@/lib/gitSync";
import type { CommentRecord, CommentSummary } from "@treewriter/shared";
import { commentAssignedToCurrentUser, currentUserAssigneeIds } from "@/lib/commentAssignees";

export function WorkspaceStatusPanel({
  filesCount,
  commentSummary,
  assignedComments = [],
  paperSlug,
  gitSync,
  viewSyncPaused,
  onResolveViewSync,
}: {
  filesCount: number;
  commentSummary: CommentSummary | null;
  assignedComments?: CommentRecord[];
  paperSlug?: string | null;
  gitSync: GitSyncState | null;
  viewSyncPaused: boolean;
  onResolveViewSync: () => void;
}) {
  const assignedToMe = useMemo(() => {
    if (!paperSlug || currentUserAssigneeIds().length === 0) return 0;
    return assignedComments.filter(
      (comment) => !comment.resolved && commentAssignedToCurrentUser(comment),
    ).length;
  }, [assignedComments, paperSlug]);

  const primaryStatus =
    commentSummary && commentSummary.unresolved > 0
      ? `${commentSummary.unresolved} unresolved comment${commentSummary.unresolved === 1 ? "" : "s"}`
      : `${filesCount} files · autosave on`;

  const syncStatus =
    gitSync && gitSyncHasError(gitSync)
      ? gitSync.lastError ?? "Git sync conflict — open git badge for details"
      : gitSync?.lastSuccessAt
        ? `Synced ${new Date(gitSync.lastSuccessAt).toLocaleTimeString()}`
        : "Awaiting sync";

  return (
    <section
      className="shrink-0 space-y-2 rounded-lg border border-border bg-card px-3 py-2.5"
      aria-label="Workspace status"
    >
      <p className="text-[11px] leading-snug text-foreground">{primaryStatus}</p>
      {assignedToMe > 0 ? (
        <p className="text-[11px] leading-snug text-primary">
          {assignedToMe} assigned to you
        </p>
      ) : null}
      {commentSummary && commentSummary.assignedUnresolved > 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {commentSummary.assignedUnresolved} assigned open
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-muted-foreground" title={gitSync?.lastError ?? undefined}>
        {syncStatus}
      </p>
      {viewSyncPaused ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full gap-1 px-2 text-[10px]"
          onClick={onResolveViewSync}
        >
          Resolve with harness
        </Button>
      ) : null}
    </section>
  );
}
