import { useEffect, useState } from "react";

const PENDING_EVENT = "treewriter:draft-pending";

const serverPendingPaths = new Set<string>();
const editorPendingPaths = new Set<string>();
let pendingPaths = new Set<string>();

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/").replace(/\/+$/, "");
}

function recomputePendingPaths(): void {
  pendingPaths = new Set([...serverPendingPaths, ...editorPendingPaths]);
  window.dispatchEvent(new CustomEvent(PENDING_EVENT));
}

export function setDraftPending(pathValue: string, isPending: boolean): void {
  const normalized = normalizePath(pathValue);
  if (!normalized) return;
  if (isPending) editorPendingPaths.add(normalized);
  else editorPendingPaths.delete(normalized);
  recomputePendingPaths();
}

/** Replace server-derived pending paths (from paper detail scan). */
export function replaceServerDraftPendingPaths(paths: string[]): void {
  serverPendingPaths.clear();
  for (const pathValue of paths) {
    const normalized = normalizePath(pathValue);
    if (normalized) serverPendingPaths.add(normalized);
  }
  recomputePendingPaths();
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
