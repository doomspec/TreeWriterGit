import { useEffect, useState } from "react";

import { loadIndexChildOrder } from "@/lib/indexChildOrder";

/** Load INDEX child_order for a single folder (breadcrumb nav menu). */
export function useFolderChildOrder(folderPath: string, refreshVersion = 0): string[] {
  const [childOrder, setChildOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!folderPath) {
      setChildOrder([]);
      return;
    }
    let cancelled = false;
    void loadIndexChildOrder(folderPath).then((order) => {
      if (!cancelled) setChildOrder(order);
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, refreshVersion]);

  return childOrder;
}
