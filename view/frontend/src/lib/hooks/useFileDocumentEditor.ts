import { useCallback, useMemo, useRef, useState } from "react";

import {
  draftSaveMeta,
  loadDraftApprovalState,
  loadModelFileContent,
  requiresDraftApproval,
  type DraftEditMeta,
  type DraftPendingSource,
} from "@/lib/draftApproval";
import { useDocumentEditor } from "@/lib/hooks/useDocumentEditor";
import { useEditorFileSync } from "@/lib/hooks/useEditorFileSync";
import { sessionKeyForFile, type EditorPaneMode } from "@/lib/editorSessionState";
import { getGitHubHandle } from "@/lib/userIdentity";
import { saveModelFile } from "@/modelApi";

type UseFileDocumentEditorOptions = {
  filePath: string;
  refreshVersion: number;
  pathVersion?: number;
  sessionKey?: string;
  defaultPaneMode?: EditorPaneMode;
  onError?: (message: string) => void;
  onSaved?: () => void;
  onApproved?: () => void | Promise<void>;
  onDiscarded?: (restored: string) => void;
  dispatchSnapshotRef?: React.MutableRefObject<string | null>;
  requiresApproval?: boolean;
};

export function useFileDocumentEditor(options: UseFileDocumentEditorOptions) {
  const {
    filePath,
    refreshVersion,
    pathVersion = 0,
    sessionKey = sessionKeyForFile(filePath),
    defaultPaneMode = "rendered",
    onError,
    onSaved,
    onApproved: onApprovedExternal,
    onDiscarded: onDiscardedExternal,
    dispatchSnapshotRef: externalDispatchSnapshotRef,
    requiresApproval: requiresApprovalOverride,
  } = options;

  const [loadedContent, setLoadedContent] = useState("");
  const [approvedBaseline, setApprovedBaseline] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMeta, setEditMeta] = useState<DraftEditMeta>({
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    approvedBy: null,
    approvedAt: null,
  });
  const internalDispatchSnapshotRef = useRef<string | null>(null);
  const dispatchSnapshotRef = externalDispatchSnapshotRef ?? internalDispatchSnapshotRef;

  const requiresApproval = useMemo(
    () => requiresApprovalOverride ?? requiresDraftApproval(filePath),
    [filePath, requiresApprovalOverride],
  );

  const saveContent = useCallback(
    async (nextContent: string, pendingSource: DraftPendingSource | null) => {
      await saveModelFile(filePath, nextContent, draftSaveMeta(pendingSource));
      if (requiresApproval) {
        const handle = getGitHubHandle();
        setEditMeta((prev) => ({
          ...prev,
          editedBy: handle || prev.editedBy,
          editedAt: new Date().toISOString(),
          aiAssisted: pendingSource === "ai" || prev.aiAssisted,
          aiProvider:
            pendingSource === "ai"
              ? draftSaveMeta("ai").aiProvider ?? prev.aiProvider
              : prev.aiProvider,
        }));
      }
    },
    [filePath, requiresApproval],
  );

  const editor = useDocumentEditor({
    sessionKey,
    defaultPaneMode,
    targetPath: filePath,
    loadedContent,
    setLoadedContent,
    approvedBaseline,
    setApprovedBaseline,
    saveContent,
    reloadAfterDiscard: () => loadModelFileContent(filePath),
    onError: (message) => {
      setLoadError(message);
      onError?.(message);
    },
    onSaved,
    onApproved: async () => {
      const { meta } = await loadDraftApprovalState(filePath);
      setEditMeta(meta);
      dispatchSnapshotRef.current = null;
      setLoadError(null);
      await onApprovedExternal?.();
    },
    onDiscarded: (restored) => {
      void loadDraftApprovalState(filePath).then(({ meta }) => setEditMeta(meta));
      dispatchSnapshotRef.current = null;
      setLoadError(null);
      onDiscardedExternal?.(restored);
    },
    requiresApproval,
  });

  const isDirtyRef = useRef(editor.isDirty);
  isDirtyRef.current = editor.isDirty;
  const loadedContentRef = useRef(loadedContent);
  loadedContentRef.current = loadedContent;
  const approvedBaselineRef = useRef(approvedBaseline);
  approvedBaselineRef.current = approvedBaseline;

  useEditorFileSync({
    filePath,
    refreshVersion,
    pathVersion,
    requiresApproval,
    isDirtyRef,
    loadedContentRef,
    approvedBaselineRef,
    dispatchSnapshotRef,
    resetHistory: editor.resetHistory,
    setLoadedContent,
    setApprovedBaseline,
    setEditMeta,
    setPendingSource: editor.setPendingSource,
    setSaveState: editor.setSaveState,
    setLoadError,
    onError,
  });

  return {
    ...editor,
    loadedContent,
    setLoadedContent,
    approvedBaseline,
    loadError,
    editMeta,
    setEditMeta,
    dispatchSnapshotRef,
    requiresApproval,
    isDirtyRef,
    loadedContentRef,
    approvedBaselineRef,
  };
}

export type FileDocumentEditorState = ReturnType<typeof useFileDocumentEditor>;
