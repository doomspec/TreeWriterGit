import { useContext, useEffect, useState } from "react";

import { fetchComments } from "@/lib/api/commentsApi";
import type { CommentRecord } from "@treewriter/shared";
import { WorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";

export function useEditorComments(
  filePath: string,
  refreshVersion: number,
  pathVersion = 0,
) {
  const nav = useContext(WorkspaceNavigationContext);
  const effectiveRefreshVersion = nav?.refreshVersion ?? refreshVersion;
  const [unresolvedComments, setUnresolvedComments] = useState(0);
  const [comments, setComments] = useState<CommentRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchComments(filePath)
      .then(({ comments: nextComments }) => {
        if (!cancelled) {
          setComments(nextComments);
          setUnresolvedComments(nextComments.filter((c) => !c.resolved).length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filePath, effectiveRefreshVersion, pathVersion]);

  return { unresolvedComments, comments, setUnresolvedComments, setComments };
}
