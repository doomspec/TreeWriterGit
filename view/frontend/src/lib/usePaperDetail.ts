import { useCallback, useEffect, useState } from "react";

import { replaceServerDraftPendingPaths } from "@/lib/draftPendingStore";
import { fetchPaperDetail, type PaperDetail } from "@/modelApi";

export function usePaperDetail(slug: string | null, refreshVersion = 0, onError?: (message: string) => void) {
  const [detail, setDetail] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!slug) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPaperDetail(slug);
      setDetail(data.paper);
      replaceServerDraftPendingPaths(data.paper.pendingApprovalPaths ?? []);
    } catch (err) {
      setDetail(null);
      replaceServerDraftPendingPaths([]);
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onError, slug]);

  useEffect(() => {
    void reload();
  }, [reload, refreshVersion]);

  return { detail, loading, reload };
}
