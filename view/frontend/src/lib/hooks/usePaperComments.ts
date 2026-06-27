import { useCallback, useEffect, useMemo, useState } from "react";

import type { CommentRecord, CommentSummary } from "@treewriter/shared";
import { fetchAssignedComments, fetchCommentSummary } from "@/lib/api/commentsApi";
import { assignedUnresolvedCountsByFolder } from "@/lib/commentAssignees";
import { collectPaperFolderPaths, type ModelNode } from "@/lib/modelTree";

export function usePaperComments({
  paperSlug,
  paperPath,
  tree,
  refreshVersion,
}: {
  paperSlug: string | null;
  paperPath: string | null;
  tree: ModelNode[];
  refreshVersion: number;
}) {
  const [commentSummary, setCommentSummary] = useState<CommentSummary | null>(null);
  const [assignedComments, setAssignedComments] = useState<CommentRecord[]>([]);

  const reloadComments = useCallback(async () => {
    if (!paperSlug || !paperPath) {
      setCommentSummary(null);
      setAssignedComments([]);
      return;
    }
    try {
      const [summary, assigned] = await Promise.all([
        fetchCommentSummary(paperSlug),
        fetchAssignedComments(paperSlug),
      ]);
      setCommentSummary(summary);
      setAssignedComments(assigned.comments);
    } catch {
      setCommentSummary(null);
      setAssignedComments([]);
    }
  }, [paperPath, paperSlug]);

  useEffect(() => {
    void reloadComments();
  }, [reloadComments, refreshVersion]);

  const assignedCountsByFolder = useMemo(() => {
    if (!paperPath) return new Map<string, number>();
    const folderPaths = collectPaperFolderPaths(tree, paperPath);
    return assignedUnresolvedCountsByFolder(assignedComments, folderPaths);
  }, [assignedComments, paperPath, tree]);

  return { commentSummary, assignedComments, assignedCountsByFolder, reloadComments };
}
