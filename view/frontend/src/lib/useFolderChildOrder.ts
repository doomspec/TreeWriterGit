import { useEffect, useMemo, useState } from "react";

import { loadIndexChildOrder } from "@/lib/indexChildOrder";
import { childOrderForFolder, type ModelNode } from "@/lib/modelTree";

/** Load INDEX child_order for a single folder (breadcrumb nav menu). */
export function useFolderChildOrder(
  folderPath: string,
  refreshVersion = 0,
  tree?: ModelNode[],
): string[] {
  const fromTree = useMemo(
    () => (tree ? childOrderForFolder(tree, folderPath) : undefined),
    [folderPath, tree],
  );
  const [fetched, setFetched] = useState<string[]>([]);

  useEffect(() => {
    if (fromTree !== undefined) return;
    if (!folderPath) {
      setFetched([]);
      return;
    }
    let cancelled = false;
    void loadIndexChildOrder(folderPath).then((order) => {
      if (!cancelled) setFetched(order);
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, fromTree, refreshVersion]);

  return fromTree ?? fetched;
}
