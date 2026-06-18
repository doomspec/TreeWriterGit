import { useCallback, useEffect, useRef, useState } from "react";

import {
  approveDraftAtPath,
  discardDraftAtPath,
  type DraftPendingSource,
} from "@/lib/draftApproval";
import { useRegisterDraftPending } from "@/lib/draftPendingStore";
import { getGitHubHandle } from "@/lib/userIdentity";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const IDLE_AFTER_SAVE_MS = 900;

/** Sticky AI flag: once AI, stay AI until approve/discard. */
export function resolvePendingSourceOnEdit(
  prev: DraftPendingSource | null,
  isPendingApproval: boolean,
  requiresApproval: boolean,
): DraftPendingSource | null {
  if (!requiresApproval) return null;
  if (!isPendingApproval) return null;
  return prev === "ai" ? "ai" : "human";
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
  onApproved?: () => void;
  onDiscarded?: (restored: string) => void;
  requiresApproval?: boolean;
  debounceMs?: number;
  autosaveEnabled?: boolean;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingSource, setPendingSource] = useState<DraftPendingSource | null>(null);
  const githubHandle = getGitHubHandle();
  const pendingSourceRef = useRef(pendingSource);
  pendingSourceRef.current = pendingSource;

  const isDirty = content !== loadedContent;
  const isPendingApproval = requiresApproval && content !== approvedBaseline;

  useRegisterDraftPending(targetPath, isPendingApproval);

  useEffect(() => {
    if (!requiresApproval) {
      setPendingSource(null);
      return;
    }
    setPendingSource((prev) => resolvePendingSourceOnEdit(prev, isPendingApproval, requiresApproval));
  }, [content, approvedBaseline, isPendingApproval, requiresApproval]);

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
      onApproved?.();
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
    pendingSource,
    setPendingSource,
    githubHandle,
    flushSave,
    handleApprove,
    handleDiscard,
  };
}
