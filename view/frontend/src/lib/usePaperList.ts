import { useCallback, useEffect, useState } from "react";

import { childrenOf, type ModelNode } from "@/lib/modelTree";
import { fetchPapers, type PaperSummary } from "@/modelApi";

export function usePaperList(
  tree: ModelNode[],
  refreshVersion = 0,
  onError?: (message: string) => void,
) {
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const list = await fetchPapers();
        setPapers(list.papers);
      } catch {
        const paperNodes = childrenOf(tree, "papers").filter((n) => n.type === "directory");
        setPapers(
          paperNodes.map((n) => ({
            slug: n.name,
            path: n.path,
            title: n.name,
            journal: "",
            status: "",
            lastExport: null,
            counts: { approved: 0, drafted: 0, outline: 0, total: 0 },
          })),
        );
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onError, tree]);

  useEffect(() => {
    void reload();
  }, [reload, refreshVersion]);

  return { papers, loading, reload };
}
