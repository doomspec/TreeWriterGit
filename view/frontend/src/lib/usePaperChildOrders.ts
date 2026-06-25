import { useEffect, useMemo, useState } from "react";

import { loadIndexChildOrder } from "@/lib/indexChildOrder";
import { childOrderForFolder, collectPaperFolderPaths, type ModelNode } from "@/lib/modelTree";

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
  const fromTree = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const folderPath of folderPaths) {
      const order = childOrderForFolder(tree, folderPath);
      if (order !== undefined && order.length > 0) map[folderPath] = order;
    }
    return map;
  }, [folderPaths, tree]);
  const missingPaths = useMemo(
    () => folderPaths.filter((folderPath) => !(folderPath in fromTree)),
    [folderPaths, fromTree],
  );
  const [fetched, setFetched] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!paperPath || missingPaths.length === 0) {
      setFetched({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        missingPaths.map(async (folderPath) => [folderPath, await loadIndexChildOrder(folderPath)] as const),
      );
      if (cancelled) return;
      setFetched(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [missingPaths, paperPath, refreshVersion]);

  return useMemo(
    () => ({ ...fromTree, ...fetched }),
    [fetched, fromTree],
  );
}
