import { useCallback, useEffect, useRef, useState } from "react";

import type { ModelNode } from "@/lib/modelTree";
import { isAnyEditorDirty } from "@/lib/editorDirtyRegistry";
import { closeWebSocket } from "@/lib/websocket";
import { fetchModelTree } from "@/modelApi";

const modelEventsUrl = import.meta.env.VITE_MODEL_EVENTS_WS_URL ?? "ws://localhost:4000/model-events";

export type ModelEventKind = "structure" | "content" | "comments";

type ModelEventPayload = {
  type?: string;
  path?: string | null;
  kind?: ModelEventKind;
  treeVersion?: number;
};

const RELOAD_DEBOUNCE_MS = 400;
const RELOAD_DEBOUNCE_DIRTY_MS = 2_000;

type UseModelTreeOptions = {
  onError?: (message: string) => void;
  onEventsRefresh?: () => void;
  onCommentsChanged?: () => void;
};

function parseModelEvent(raw: MessageEvent): ModelEventPayload {
  try {
    return JSON.parse(String(raw.data)) as ModelEventPayload;
  } catch {
    return {};
  }
}

function inferEventKind(path: string | null | undefined): ModelEventKind {
  if (!path) return "structure";
  const normalized = path.replace(/\\/g, "/");
  if (normalized.endsWith("/draft.md") || normalized.endsWith("/outline.md")) {
    return "content";
  }
  return "structure";
}

function treeSnapshot(tree: ModelNode[]): string {
  return JSON.stringify(tree);
}

export function useModelTree(options: UseModelTreeOptions = {}) {
  const { onError, onEventsRefresh, onCommentsChanged } = options;
  const onErrorRef = useRef(onError);
  const onEventsRefreshRef = useRef(onEventsRefresh);
  const onCommentsChangedRef = useRef(onCommentsChanged);
  const treeSnapshotRef = useRef("");
  const pathVersionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    onErrorRef.current = onError;
    onEventsRefreshRef.current = onEventsRefresh;
    onCommentsChangedRef.current = onCommentsChanged;
  }, [onCommentsChanged, onError, onEventsRefresh]);

  const [tree, setTree] = useState<ModelNode[]>([]);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pathVersionTick, setPathVersionTick] = useState(0);

  const bumpPath = useCallback((path: string | null | undefined) => {
    if (!path) return;
    const normalized = path.replace(/\\/g, "/");
    pathVersionsRef.current[normalized] = (pathVersionsRef.current[normalized] ?? 0) + 1;
    setPathVersionTick((v) => v + 1);
  }, []);

  const getPathVersion = useCallback(
    (path: string): number => {
      void pathVersionTick;
      return pathVersionsRef.current[path.replace(/\\/g, "/")] ?? 0;
    },
    [pathVersionTick],
  );

  const applyTree = useCallback((nextTree: ModelNode[]): boolean => {
    const snapshot = treeSnapshot(nextTree);
    const changed = snapshot !== treeSnapshotRef.current;
    treeSnapshotRef.current = snapshot;
    setTree(nextTree);
    setTreeLoaded(true);
    return changed;
  }, []);

  const loadTree = useCallback(async (): Promise<boolean> => {
    const data = await fetchModelTree();
    return applyTree(data.tree);
  }, [applyTree]);

  const reloadModel = useCallback(() => {
    if (isAnyEditorDirty()) return;
    loadTree()
      .then((changed) => {
        if (changed) setRefreshVersion((v) => v + 1);
      })
      .catch(() => {});
  }, [loadTree]);

  useEffect(() => {
    loadTree().catch((err) =>
      onErrorRef.current?.(err instanceof Error ? err.message : String(err)),
    );
  }, [loadTree]);

  useEffect(() => {
    let active = true;
    let reloadTimer: number | undefined;
    let reconnectTimer: number | undefined;
    let retryAttempt = 0;
    let socket: WebSocket | null = null;

    const scheduleReload = (payload: ModelEventPayload) => {
      window.clearTimeout(reloadTimer);
      const kind = payload.kind ?? inferEventKind(payload.path);
      if (payload.path) bumpPath(payload.path);
      if (kind === "content") return;

      const delay = isAnyEditorDirty() ? RELOAD_DEBOUNCE_DIRTY_MS : RELOAD_DEBOUNCE_MS;
      reloadTimer = window.setTimeout(() => {
        if (!active) return;
        if (isAnyEditorDirty()) return;
        loadTree()
          .then((changed) => {
            if (!active || !changed) return;
            onEventsRefreshRef.current?.();
            setRefreshVersion((v) => v + 1);
          })
          .catch(() => {});
      }, delay);
    };

    const connect = () => {
      if (!active) return;
      socket = new WebSocket(modelEventsUrl);

      socket.addEventListener("open", () => {
        if (!active) {
          closeWebSocket(socket!);
          return;
        }
        retryAttempt = 0;
      });

      socket.addEventListener("message", (event) => {
        if (!active) return;
        const payload = parseModelEvent(event);
        if (payload.type === "connected") return;

        if (payload.type === "comments-changed") {
          onCommentsChangedRef.current?.();
          if (payload.path) bumpPath(payload.path);
          return;
        }

        scheduleReload(payload);
      });

      socket.addEventListener("close", () => {
        if (!active) return;
        const delay = Math.min(30_000, 1_000 * 2 ** retryAttempt);
        retryAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      });
    };

    connect();

    return () => {
      active = false;
      window.clearTimeout(reloadTimer);
      window.clearTimeout(reconnectTimer);
      if (socket) closeWebSocket(socket);
    };
  }, [bumpPath, loadTree]);

  return { tree, treeLoaded, refreshVersion, getPathVersion, loadTree, reloadModel };
}
