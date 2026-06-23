import { useEffect, useRef } from "react";

import { effectiveDiffBaseline } from "@/lib/draftDiff";
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
  approvedBaselineRef: React.MutableRefObject<string>;
  dispatchSnapshotRef: React.MutableRefObject<string | null>;
  resetHistory: (value: string) => void;
  setLoadedContent: (content: string) => void;
  setApprovedBaseline: (baseline: string) => void;
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
      setApprovedBaseline("");
      return () => {
        cancelled = true;
      };
    }
    void loadDraftApprovalState(filePath).then(({ content: baseline, meta }) => {
      if (!cancelled) {
        setApprovedBaseline(baseline);
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
      .then(async (diskContent) => {
        if (cancelled) return;
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

        resetHistory(diskContent);
        setLoadedContent(diskContent);
        if (requiresApproval && snapshot !== null && diskContent !== snapshot) {
          setPendingSource("ai");
          void loadDraftApprovalState(filePath).then(({ meta }) => {
            if (!cancelled) setEditMeta(meta);
          });
        } else if (requiresApproval && diskContent !== baseline) {
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
    setEditMeta,
    setLoadedContent,
    setLoadError,
    setPendingSource,
    setSaveState,
    version,
  ]);
}
