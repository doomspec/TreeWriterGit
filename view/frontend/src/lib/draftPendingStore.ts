import { useEffect, useState } from "react";

const PENDING_EVENT = "treewriter:draft-pending";

const pendingPaths = new Set<string>();

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function setDraftPending(pathValue: string, isPending: boolean): void {
  const normalized = normalizePath(pathValue);
  if (!normalized) return;
  if (isPending) pendingPaths.add(normalized);
  else pendingPaths.delete(normalized);
  window.dispatchEvent(new CustomEvent(PENDING_EVENT));
}

export function getDraftPendingPaths(): ReadonlySet<string> {
  return pendingPaths;
}

/** True when this folder or any pending draft path lies beneath it. */
export function containerHasDraftPending(containerPath: string): boolean {
  const normalized = normalizePath(containerPath);
  if (!normalized) return false;
  for (const pending of pendingPaths) {
    if (pending === normalized || pending.startsWith(`${normalized}/`)) return true;
  }
  return false;
}

export function subscribeDraftPending(listener: () => void): () => void {
  window.addEventListener(PENDING_EVENT, listener);
  return () => window.removeEventListener(PENDING_EVENT, listener);
}

export function useDraftPendingPaths(): ReadonlySet<string> {
  const [paths, setPaths] = useState(() => new Set(getDraftPendingPaths()));
  useEffect(() => subscribeDraftPending(() => setPaths(new Set(getDraftPendingPaths()))), []);
  return paths;
}

export function useRegisterDraftPending(pathValue: string, isPending: boolean): void {
  useEffect(() => {
    if (!pathValue) return;
    if (isPending) setDraftPending(pathValue, true);
    return () => setDraftPending(pathValue, false);
  }, [isPending, pathValue]);
}
