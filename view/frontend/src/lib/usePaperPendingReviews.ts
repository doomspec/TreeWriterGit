import { useMemo } from "react";

import {
  getServerPendingReviews,
  useDraftPendingPaths,
  useEditorDraftPendingPaths,
} from "@/lib/draftPendingStore";
import { groupPendingReviewsByAuthor, mergePendingReviews } from "@/lib/pendingReviews";
import { usePaperDetail } from "@/lib/usePaperDetail";

export function usePaperPendingReviews(
  paperSlug: string | null,
  refreshVersion = 0,
  onError?: (message: string) => void,
) {
  const { loading, reload } = usePaperDetail(paperSlug, refreshVersion, onError);
  const pendingPaths = useDraftPendingPaths();
  const editorPaths = useEditorDraftPendingPaths();

  const items = useMemo(() => {
    const serverItems = getServerPendingReviews();
    const paperPrefix = paperSlug ? `papers/${paperSlug}/` : "";
    const scopedServer = paperPrefix
      ? serverItems.filter((item) => item.path.startsWith(paperPrefix))
      : serverItems;
    const scopedEditor = paperPrefix
      ? [...editorPaths].filter((path) => path.startsWith(paperPrefix))
      : [...editorPaths];
    const scopedPending = paperPrefix
      ? [...pendingPaths].filter((path) => path.startsWith(paperPrefix))
      : [...pendingPaths];
    const extraPaths = new Set([...scopedEditor, ...scopedPending]);
    for (const item of scopedServer) extraPaths.delete(item.path);
    return mergePendingReviews(scopedServer, extraPaths);
  }, [editorPaths, paperSlug, pendingPaths]);

  const groups = useMemo(() => groupPendingReviewsByAuthor(items), [items]);

  return {
    loading,
    reload,
    items,
    groups,
    totalCount: items.length,
  };
}
