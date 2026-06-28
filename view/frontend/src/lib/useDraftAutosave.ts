import { useCallback, useEffect, useRef, useState } from "react";

import {
  approveDraftAtPath,
  discardDraftAtPath,
  type DraftEditMeta,
  type DraftPendingSource,
} from "@/lib/draftApproval";
import { hasPendingApprovalDiff } from "@/lib/draftDiff";
import { useRegisterDraftPending } from "@/lib/draftPendingStore";
import { getGitHubHandle } from "@/lib/userIdentity";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const IDLE_AFTER_SAVE_MS = 900;

/** Sticky AI flag: once AI, stay AI until approve/discard. Human only after a session edit. */
export function resolvePendingSourceOnEdit(
  prev: DraftPendingSource | null,
  isPendingApproval: boolean,
  requiresApproval: boolean,
  isDirty: boolean,
  meta?: Pick<DraftEditMeta, "aiAssisted">,
): DraftPendingSource | null {
  if (!requiresApproval || !isPendingApproval) return null;
  if (prev === "ai") return "ai";
  if (prev === "human") return "human";
  if (meta?.aiAssisted) return "ai";
  if (isDirty) return "human";
  return null;
}

export function showSessionApprovalChrome(
  isPendingApproval: boolean,
  _isDirty: boolean,
  _pendingSource: DraftPendingSource | null,
): boolean {
  return isPendingApproval;
}

export function useDraftAutosave({
  targetPath,
  content,
  loadedContent,
  setLoadedContent,
  approvedBaseline,
  setApprovedBaseline,
  saveContent,
  reloadAfterDiscard,
  onError,
  onSaved,
  onApproved,
  onDiscarded,
  requiresApproval = true,
  debounceMs = 800,
  autosaveEnabled = true,
  editMeta,
}: {
  targetPath: string;
  content: string;
  loadedContent: string;
  setLoadedContent: (value: string) => void;
  approvedBaseline: string;
  setApprovedBaseline: (value: string) => void;
  saveContent: (content: string, pendingSource: DraftPendingSource | null) => Promise<void>;
  reloadAfterDiscard?: () => Promise<string>;
  onError?: (message: string) => void;
  onSaved?: () => void;
  onApproved?: () => void | Promise<void>;
  onDiscarded?: (restored: string) => void;
  requiresApproval?: boolean;
  debounceMs?: number;
  autosaveEnabled?: boolean;
  editMeta?: Pick<DraftEditMeta, "aiAssisted">;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingSource, setPendingSource] = useState<DraftPendingSource | null>(null);
  const githubHandle = getGitHubHandle();
  const pendingSourceRef = useRef(pendingSource);
  pendingSourceRef.current = pendingSource;

  const isDirty = content !== loadedContent;
  const isPendingApproval =
    requiresApproval && hasPendingApprovalDiff(approvedBaseline, loadedContent, content);
  const sessionApprovalActive = showSessionApprovalChrome(
    isPendingApproval,
    isDirty,
    pendingSource,
  );

  useRegisterDraftPending(targetPath, sessionApprovalActive);

  useEffect(() => {
    if (!requiresApproval) {
      setPendingSource(null);
      return;
    }
    setPendingSource((prev) =>
      resolvePendingSourceOnEdit(prev, isPendingApproval, requiresApproval, isDirty, editMeta),
    );
  }, [content, approvedBaseline, editMeta?.aiAssisted, isDirty, isPendingApproval, requiresApproval]);

  const flushSave = useCallback(async () => {
    if (!isDirty) return;
    setSaveState("saving");
    try {
      await saveContent(content, pendingSourceRef.current);
      setLoadedContent(content);
      setSaveState("saved");
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveState("error");
      onError?.(message);
      throw err;
    }
  }, [content, isDirty, onError, onSaved, saveContent, setLoadedContent]);

  const handleApprove = useCallback(async () => {
    if (!requiresApproval) return;
    setSaveState("saving");
    try {
      if (isDirty) {
        await saveContent(content, pendingSourceRef.current);
      }
      await approveDraftAtPath(targetPath, githubHandle || null);
      setLoadedContent(content);
      setApprovedBaseline(content);
      setPendingSource(null);
      setSaveState("saved");
      onSaved?.();
      await onApproved?.();
      window.setTimeout(() => setSaveState("idle"), IDLE_AFTER_SAVE_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveState("error");
      onError?.(message);
    }
  }, [
    content,
    githubHandle,
    isDirty,
    onApproved,
    onError,
    onSaved,
    requiresApproval,
    saveContent,
    setApprovedBaseline,
    setLoadedContent,
    targetPath,
  ]);

  const handleDiscard = useCallback(async () => {
    if (!requiresApproval) return;
    setSaveState("saving");
    try {
      await discardDraftAtPath(targetPath);
      const restored = reloadAfterDiscard ? await reloadAfterDiscard() : content;
      setLoadedContent(restored);
      setApprovedBaseline(restored);
      setPendingSource(null);
      setSaveState("idle");
      onDiscarded?.(restored);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveState("error");
      onError?.(message);
    }
  }, [
    content,
    onDiscarded,
    onError,
    reloadAfterDiscard,
    requiresApproval,
    setApprovedBaseline,
    setLoadedContent,
    targetPath,
  ]);

  useEffect(() => {
    if (!autosaveEnabled || !isDirty) return;
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      const nextContent = content;
      try {
        await saveContent(nextContent, pendingSourceRef.current);
        setLoadedContent(nextContent);
        setSaveState("saved");
        onSaved?.();
        window.setTimeout(() => setSaveState("idle"), IDLE_AFTER_SAVE_MS);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveState("error");
        onError?.(message);
      }
    }, debounceMs);
    return () => window.clearTimeout(timeout);
  }, [
    autosaveEnabled,
    content,
    debounceMs,
    isDirty,
    onError,
    onSaved,
    saveContent,
    setLoadedContent,
  ]);

  return {
    saveState,
    setSaveState,
    isDirty,
    isPendingApproval,
    sessionApprovalActive,
    pendingSource,
    setPendingSource,
    githubHandle,
    flushSave,
    handleApprove,
    handleDiscard,
  };
}
