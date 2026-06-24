import { useEffect, useMemo, useState } from "react";

import { loadIndexChildOrder } from "@/lib/indexChildOrder";
import { collectPaperFolderPaths } from "@/lib/modelTree";
import type { ModelNode } from "@/lib/modelTree";

/** Load INDEX child_order for every folder under a paper (shared by section list + browse tree). */
export function usePaperChildOrders(
  tree: ModelNode[],
  paperPath: string | null,
  refreshVersion = 0,
): Record<string, string[]> {
  const folderPaths = useMemo(
    () => (paperPath ? collectPaperFolderPaths(tree, paperPath) : []),
    [paperPath, tree],
  );
  const [childOrders, setChildOrders] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!paperPath || folderPaths.length === 0) {
      setChildOrders({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        folderPaths.map(async (folderPath) => [folderPath, await loadIndexChildOrder(folderPath)] as const),
      );
      if (cancelled) return;
      setChildOrders(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [folderPaths, paperPath, refreshVersion]);

  return childOrders;
}
