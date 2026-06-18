import { useCallback, useEffect, useState } from "react";

import type { ModelNode } from "@/lib/modelTree";
import { fetchModelTree } from "@/modelApi";

const modelEventsUrl = import.meta.env.VITE_MODEL_EVENTS_WS_URL ?? "ws://localhost:4000/model-events";

type UseModelTreeOptions = {
  onError?: (message: string) => void;
  onEventsRefresh?: () => void;
};

export function useModelTree(options: UseModelTreeOptions = {}) {
  const { onError, onEventsRefresh } = options;
  const [tree, setTree] = useState<ModelNode[]>([]);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const loadTree = useCallback(async () => {
    const data = await fetchModelTree();
    setTree(data.tree);
    setTreeLoaded(true);
  }, []);

  const reloadModel = useCallback(() => {
    loadTree().catch(() => {});
    setRefreshVersion((v) => v + 1);
  }, [loadTree]);

  useEffect(() => {
    loadTree().catch((err) => onError?.(err instanceof Error ? err.message : String(err)));
  }, [loadTree, onError]);

  useEffect(() => {
    const socket = new WebSocket(modelEventsUrl);
    let reloadTimer: number | undefined;
    socket.addEventListener("message", () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        loadTree().catch(() => {});
        onEventsRefresh?.();
        setRefreshVersion((v) => v + 1);
      }, 150);
    });
    return () => {
      window.clearTimeout(reloadTimer);
      socket.close();
    };
  }, [loadTree, onEventsRefresh]);

  return { tree, treeLoaded, refreshVersion, loadTree, reloadModel };
}
