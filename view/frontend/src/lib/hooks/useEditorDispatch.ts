import { useCallback, useMemo } from "react";

import {
  dispatchActionForUnitPane,
  type AgentDispatchAction,
} from "@/lib/agentDispatchClient";
import { useAgentDispatchPanelOptional } from "@/lib/agentDispatchPanel";
import { useDispatchJob } from "@/lib/useDispatchJob";

type UseEditorDispatchOptions = {
  enabled: boolean;
  compact: boolean;
  paneLabel?: string;
  unitPath: string | null;
  previewBody: string;
  content: string;
  isFigureUnit: boolean;
  pane?: "outline" | "draft";
  requiresApproval: boolean;
  approvedBaseline: string | null;
  flushSave: () => Promise<void>;
  onBeforeDispatch?: () => void;
  onDispatchComplete?: () => void;
  onError?: (message: string) => void;
  dispatchSnapshotRef: React.MutableRefObject<string | null>;
};

export function useEditorDispatch({
  enabled,
  compact,
  paneLabel,
  unitPath,
  previewBody,
  content,
  isFigureUnit,
  pane,
  requiresApproval,
  approvedBaseline,
  flushSave,
  onBeforeDispatch,
  onDispatchComplete,
  onError,
  dispatchSnapshotRef,
}: UseEditorDispatchOptions) {
  const dispatchAction = useMemo(
    () =>
      enabled
        ? dispatchActionForUnitPane(
            paneLabel,
            Boolean(previewBody.trim() || content.trim()),
            isFigureUnit,
          )
        : null,
    [content, enabled, isFigureUnit, paneLabel, previewBody],
  );

  const canDispatch = Boolean(compact && unitPath && dispatchAction);
  const agentDispatchPanel = useAgentDispatchPanelOptional();

  const { progress: dispatchProgress, dispatching, runUnitDispatch } = useDispatchJob({
    scope: "unit",
    targetPath: unitPath,
    pane,
    onResumeComplete: onDispatchComplete,
    onError,
  });

  const handleDispatch = useCallback(async () => {
    if (!canDispatch || !unitPath || !dispatchAction) return;
    try {
      if (requiresApproval) {
        dispatchSnapshotRef.current = approvedBaseline;
      }
      await flushSave();
      onBeforeDispatch?.();
      await runUnitDispatch({
        unitPath,
        action: dispatchAction,
      });
      onDispatchComplete?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }, [
    approvedBaseline,
    canDispatch,
    dispatchAction,
    dispatchSnapshotRef,
    flushSave,
    onBeforeDispatch,
    onDispatchComplete,
    onError,
    requiresApproval,
    runUnitDispatch,
    unitPath,
  ]);

  const handleOpenAiDispatch = useCallback(() => {
    if (!canDispatch || !dispatchAction) return;
    if (agentDispatchPanel) {
      agentDispatchPanel.openDispatch({
        action: dispatchAction,
        pane,
        autoPreview: true,
      });
      return;
    }
    void handleDispatch();
  }, [agentDispatchPanel, canDispatch, dispatchAction, handleDispatch, pane]);

  return {
    dispatchAction: dispatchAction as AgentDispatchAction | null,
    canDispatch,
    dispatchProgress,
    dispatching,
    handleDispatch,
    handleOpenAiDispatch,
  };
}
