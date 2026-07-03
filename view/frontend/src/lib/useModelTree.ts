import { useCallback, useEffect, useRef, useState } from "react";

import type { ModelNode } from "@/lib/modelTree";
import { isAnyEditorDirty } from "@/lib/editorDirtyRegistry";
import {
  ensurePathLoaded,
  hasTreeAnchor,
  replaceSubtree,
  subtreeRootForChange,
} from "@/lib/modelTreeMerge";
import { isApiTemporarilyOffline } from "@/lib/apiClient";
import { wasRecentlySelfSaved } from "@/lib/recentSelfSaves";
import { closeWebSocket } from "@/lib/websocket";
import { fetchModelTree, type FetchModelTreeOptions } from "@/modelApi";

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
const INITIAL_TREE_DEPTH = 1;

type UseModelTreeOptions = {
  onError?: (message: string) => void;
  onEventsRefresh?: () => void;
  onCommentsChanged?: () => void;
};

export type ReloadModelScope = {
  path?: string;
  depth?: number;
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
  if (
    normalized.endsWith("/draft.md") ||
    normalized.endsWith("/outline.md") ||
    normalized.endsWith("/temp-notes.md")
  ) {
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
  const treeRef = useRef<ModelNode[]>([]);
  const pathVersionsRef = useRef<Record<string, number>>({});
  const serverTreeVersionRef = useRef(0);

  useEffect(() => {
    onErrorRef.current = onError;
    onEventsRefreshRef.current = onEventsRefresh;
    onCommentsChangedRef.current = onCommentsChanged;
  }, [onCommentsChanged, onError, onEventsRefresh]);

  const [tree, setTree] = useState<ModelNode[]>([]);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pathVersionTick, setPathVersionTick] = useState(0);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

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
    treeRef.current = nextTree;
    setTree(nextTree);
    setTreeLoaded(true);
    return changed;
  }, []);

  const noteTreeVersion = useCallback((treeVersion?: number) => {
    if (typeof treeVersion === "number" && Number.isFinite(treeVersion)) {
      serverTreeVersionRef.current = treeVersion;
    }
  }, []);

  const loadTree = useCallback(
    async (fetchOptions: FetchModelTreeOptions = {}): Promise<boolean> => {
      const data = await fetchModelTree(fetchOptions);
      noteTreeVersion(data.treeVersion);
      return applyTree(data.tree);
    },
    [applyTree, noteTreeVersion],
  );

  const loadTreePath = useCallback(
    async (folderPath: string, depth?: number): Promise<boolean> => {
      const normalized = folderPath.replace(/\\/g, "/");
      const data = await fetchModelTree({
        path: normalized || undefined,
        depth,
      });
      noteTreeVersion(data.treeVersion);
      if (!normalized) {
        return applyTree(data.tree);
      }
      const merged = replaceSubtree(treeRef.current, normalized, data.tree);
      return applyTree(merged);
    },
    [applyTree, noteTreeVersion],
  );

  const patchSubtreeAt = useCallback(
    async (folderPath: string): Promise<boolean> => {
      const normalized = subtreeRootForChange(folderPath);
      if (normalized && !hasTreeAnchor(treeRef.current, normalized)) {
        return loadTree();
      }
      const data = await fetchModelTree({ path: normalized || undefined });
      noteTreeVersion(data.treeVersion);
      const merged = normalized
        ? replaceSubtree(treeRef.current, normalized, data.tree)
        : data.tree;
      return applyTree(merged);
    },
    [applyTree, loadTree, noteTreeVersion],
  );

  const ensureTreePath = useCallback(
    async (targetPath: string): Promise<void> => {
      const normalized = targetPath.replace(/\\/g, "/");
      if (!normalized) return;

      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (hasTreeAnchor(treeRef.current, normalized)) break;
        const missing = ensurePathLoaded(treeRef.current, normalized);
        if (missing.length === 0) break;
        const nextPath = missing[0] ?? "";
        await loadTreePath(nextPath, nextPath ? 1 : INITIAL_TREE_DEPTH);
      }

      if (hasTreeAnchor(treeRef.current, normalized)) {
        await loadTreePath(normalized);
      }
    },
    [loadTreePath],
  );

  const reloadModel = useCallback(
    (scope?: ReloadModelScope) => {
      if (isAnyEditorDirty()) return;
      const run = scope?.path
        ? () => loadTreePath(scope.path!, scope.depth)
        : () => loadTree({ depth: INITIAL_TREE_DEPTH });
      run()
        .then((changed) => {
          if (changed) setRefreshVersion((v) => v + 1);
        })
        .catch(() => {});
    },
    [loadTree, loadTreePath],
  );

  useEffect(() => {
    loadTree({ depth: INITIAL_TREE_DEPTH }).catch((err) =>
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
      // A content event for a file THIS client just saved is an echo of our own
      // write — skip the path-version bump so the editor doesn't re-run its
      // file-load effect against content it already has (avoids the type→save→
      // broadcast→reload flicker loop). External writes aren't self-marked, so
      // they still bump and refresh the open editor.
      if (payload.path && !(kind === "content" && wasRecentlySelfSaved(payload.path))) {
        bumpPath(payload.path);
      }
      if (kind === "content") return;

      const eventVersion = payload.treeVersion;
      const clientVersion = serverTreeVersionRef.current;
      const missedStructureEvents =
        typeof eventVersion === "number" &&
        Number.isFinite(eventVersion) &&
        eventVersion > clientVersion + 1;

      const delay = isAnyEditorDirty() ? RELOAD_DEBOUNCE_DIRTY_MS : RELOAD_DEBOUNCE_MS;
      reloadTimer = window.setTimeout(() => {
        if (!active) return;
        if (isAnyEditorDirty()) return;

        const runReload = missedStructureEvents
          ? () => loadTree({ depth: INITIAL_TREE_DEPTH })
          : payload.path
            ? () => patchSubtreeAt(subtreeRootForChange(payload.path))
            : () => loadTree({ depth: INITIAL_TREE_DEPTH });

        runReload()
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
      if (isApiTemporarilyOffline()) {
        const delay = Math.min(30_000, 1_000 * 2 ** retryAttempt);
        retryAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
        return;
      }
      const nextSocket = new WebSocket(modelEventsUrl);
      socket = nextSocket;

      nextSocket.addEventListener("open", () => {
        if (!active) {
          closeWebSocket(nextSocket);
          return;
        }
        retryAttempt = 0;
      });

      nextSocket.addEventListener("message", (event) => {
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

      nextSocket.addEventListener("error", () => {
        closeWebSocket(nextSocket);
      });

      nextSocket.addEventListener("close", () => {
        if (!active || socket !== nextSocket) return;
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
  }, [bumpPath, loadTree, patchSubtreeAt]);

  return {
    tree,
    treeLoaded,
    refreshVersion,
    getPathVersion,
    loadTree,
    loadTreePath,
    ensureTreePath,
    reloadModel,
  };
}
