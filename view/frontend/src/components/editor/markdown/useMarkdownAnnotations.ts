import { useCallback, useEffect, useState } from "react";

import { sortCommentsByLine } from "@/lib/sortCommentsByLine";
import { fetchComments, type CommentRecord } from "@/modelApi";

export function useMarkdownAnnotations({
  commentsOpen,
  filePath,
  refreshVersion,
  pathVersion,
  setSelectedLine,
}: {
  commentsOpen: boolean;
  filePath: string;
  refreshVersion: number;
  pathVersion: number;
  setSelectedLine: (line: number) => void;
}) {
  const [annotationIndex, setAnnotationIndex] = useState(0);
  const [annotationItems, setAnnotationItems] = useState<CommentRecord[]>([]);

  useEffect(() => {
    if (!commentsOpen) {
      setAnnotationItems([]);
      setAnnotationIndex(0);
      return;
    }
    let cancelled = false;
    void fetchComments(filePath)
      .then(({ comments }) => {
        if (cancelled) return;
        const sorted = sortCommentsByLine(comments);
        setAnnotationItems(sorted);
        setAnnotationIndex(0);
        if (sorted.length > 0) setSelectedLine(sorted[0].line);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [commentsOpen, filePath, pathVersion, refreshVersion, setSelectedLine]);

  const handleAnnotationIndexChange = useCallback(
    (index: number) => {
      setAnnotationIndex(index);
      const item = annotationItems[index];
      if (item) setSelectedLine(item.line);
    },
    [annotationItems, setSelectedLine],
  );

  return { annotationIndex, annotationItems, handleAnnotationIndexChange };
}
