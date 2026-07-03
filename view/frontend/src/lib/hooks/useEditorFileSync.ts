import { useEffect, useRef } from "react";

import { effectiveDiffBaseline } from "@/lib/draftDiff";
import { repairEditorMacroSyntax } from "@/lib/editorMacroRepair";
import { normalizeLoadedContentForPath } from "@/lib/tempNotes";
import {
  loadDraftApprovalState,
  loadModelFileContent,
  type DraftPendingSource,
} from "@/lib/draftApproval";
import type { SaveState } from "@/lib/useDraftAutosave";

type UseEditorFileSyncOptions = {
  filePath: string;
  refreshVersion: number;
  pathVersion?: number;
  requiresApproval: boolean;
  isDirtyRef: React.MutableRefObject<boolean>;
  loadedContentRef: React.MutableRefObject<string>;
  approvedBaselineRef: React.MutableRefObject<string | null>;
  dispatchSnapshotRef: React.MutableRefObject<string | null>;
  resetHistory: (value: string) => void;
  setLoadedContent: (content: string) => void;
  setApprovedBaseline: (baseline: string | null) => void;
  setEditMeta: React.Dispatch<React.SetStateAction<import("@/lib/draftApproval").DraftEditMeta>>;
  setPendingSource: React.Dispatch<React.SetStateAction<DraftPendingSource | null>>;
  setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
  setLoadError: (message: string | null) => void;
  onError?: (message: string) => void;
};

export function useEditorFileSync({
  filePath,
  refreshVersion,
  pathVersion = 0,
  requiresApproval,
  isDirtyRef,
  loadedContentRef,
  approvedBaselineRef,
  dispatchSnapshotRef,
  resetHistory,
  setLoadedContent,
  setApprovedBaseline,
  setEditMeta,
  setPendingSource,
  setSaveState,
  setLoadError,
  onError,
}: UseEditorFileSyncOptions) {
  const version = refreshVersion + pathVersion;

  useEffect(() => {
    let cancelled = false;
    if (!requiresApproval) {
      setApprovedBaseline(null);
      return () => {
        cancelled = true;
      };
    }
    void loadDraftApprovalState(filePath).then(({ content: baseline, meta }) => {
      if (!cancelled) {
        // meta.approvedAt is the only reliable signal that an approval record
        // exists — the content itself can legitimately be "" when something
        // was approved while still empty, which must NOT be treated the same
        // as "never approved" (see effectiveDiffBaseline in draftDiff.ts).
        setApprovedBaseline(meta.approvedAt !== null ? baseline : null);
        setEditMeta(meta);
        if (meta.aiAssisted) {
          setPendingSource((prev) => (prev === "human" ? prev : "ai"));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filePath, requiresApproval, setApprovedBaseline, setEditMeta, setPendingSource, version]);

  useEffect(() => {
    let cancelled = false;
    if (isDirtyRef.current) {
      return () => {
        cancelled = true;
      };
    }

    void loadModelFileContent(filePath)
      .then(async (rawContent) => {
        if (cancelled) return;
        const diskContent = normalizeLoadedContentForPath(filePath, rawContent);
        const snapshot = dispatchSnapshotRef.current;
        dispatchSnapshotRef.current = null;
        const baseline = effectiveDiffBaseline(approvedBaselineRef.current, loadedContentRef.current);
        const unchangedOnDisk = diskContent === loadedContentRef.current;

        if (unchangedOnDisk && snapshot === null) {
          if (requiresApproval && diskContent !== baseline) {
            void loadDraftApprovalState(filePath).then(({ meta }) => {
              if (!cancelled) {
                setEditMeta(meta);
                if (meta.aiAssisted) {
                  setPendingSource((prev) => (prev === "human" ? prev : "ai"));
                }
              }
            });
          } else if (!requiresApproval || diskContent === baseline) {
            setPendingSource(null);
          }
          setSaveState("idle");
          setLoadError(null);
          return;
        }

        const normalized = repairEditorMacroSyntax(diskContent);
        // Freeze the pre-change content as the diff floor the first time an
        // external (non-self) edit lands on a never-approved unit — otherwise
        // loadedContent below chases the incoming content and the pending
        // diff (loadedContent vs current) collapses to "no change" before
        // anyone gets to see it (the reported missing-highlight bug for
        // section-sync-authored and other externally-written child edits).
        const priorLoaded = loadedContentRef.current;
        resetHistory(normalized);
        setLoadedContent(normalized);
        if (requiresApproval && snapshot !== null && diskContent !== snapshot) {
          setPendingSource("ai");
          if (approvedBaselineRef.current === null) setApprovedBaseline(priorLoaded);
          void loadDraftApprovalState(filePath).then(({ meta }) => {
            if (!cancelled) setEditMeta(meta);
          });
        } else if (requiresApproval && diskContent !== baseline) {
          if (approvedBaselineRef.current === null) setApprovedBaseline(priorLoaded);
          void loadDraftApprovalState(filePath).then(({ meta }) => {
            if (!cancelled) {
              setEditMeta(meta);
              if (meta.aiAssisted) {
                setPendingSource((prev) => (prev === "human" ? prev : "ai"));
              }
            }
          });
        } else if (!requiresApproval || diskContent === baseline) {
          setPendingSource(null);
        }
        setSaveState("idle");
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setLoadError(message);
          setSaveState("error");
          onError?.(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    approvedBaselineRef,
    dispatchSnapshotRef,
    filePath,
    isDirtyRef,
    loadedContentRef,
    onError,
    requiresApproval,
    resetHistory,
    setApprovedBaseline,
    setEditMeta,
    setLoadedContent,
    setLoadError,
    setPendingSource,
    setSaveState,
    version,
  ]);
}
