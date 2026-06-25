import { useContext, useEffect, useState } from "react";

import { fetchComments } from "@/lib/api/commentsApi";
import { WorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";

export function useEditorComments(
  filePath: string,
  refreshVersion: number,
  pathVersion = 0,
  options?: { fetchEnabled?: boolean },
) {
  const nav = useContext(WorkspaceNavigationContext);
  const effectiveRefreshVersion = nav?.refreshVersion ?? refreshVersion;
  const fetchEnabled = options?.fetchEnabled ?? true;
  const [unresolvedComments, setUnresolvedComments] = useState(0);

  useEffect(() => {
    if (!fetchEnabled) return;
    let cancelled = false;
    fetchComments(filePath)
      .then(({ comments }) => {
        if (!cancelled) {
          setUnresolvedComments(comments.filter((c) => !c.resolved).length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchEnabled, filePath, effectiveRefreshVersion, pathVersion]);

  return { unresolvedComments, setUnresolvedComments };
}
