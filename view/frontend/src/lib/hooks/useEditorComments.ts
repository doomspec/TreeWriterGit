import { useEffect, useState } from "react";

import { fetchComments } from "@/modelApi";

export function useEditorComments(filePath: string, refreshVersion: number, pathVersion = 0) {
  const [unresolvedComments, setUnresolvedComments] = useState(0);

  useEffect(() => {
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
  }, [filePath, refreshVersion, pathVersion]);

  return { unresolvedComments };
}
