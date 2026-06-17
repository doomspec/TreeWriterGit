import { useEffect, useMemo, useState } from "react";

import { collectPaperFolderPaths, indexPathFor, parseIndexFrontmatter } from "@/lib/modelTree";
import type { ModelNode } from "@/lib/modelTree";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function fetchChildOrder(folderPath: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/model/file?path=${encodeURIComponent(indexPathFor(folderPath))}`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { content: string };
    return parseIndexFrontmatter(data.content).childOrder;
  } catch {
    return [];
  }
}

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
        folderPaths.map(async (folderPath) => [folderPath, await fetchChildOrder(folderPath)] as const),
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
