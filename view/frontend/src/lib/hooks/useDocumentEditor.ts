import { useCallback } from "react";

import { applyMarkdownFormat, type MarkdownFormatAction } from "@/lib/markdownFormat";
import { handleFormatShortcut } from "@/lib/editor/formatShortcut";
import { useDraftAutosave, type SaveState } from "@/lib/useDraftAutosave";
import { useEditorDirty } from "@/lib/editorDirtyRegistry";
import { useEditorHistory } from "@/lib/useEditorHistory";
import { usePersistedEditorSession } from "@/lib/usePersistedEditorSession";
import { type EditorPaneMode } from "@/lib/editorSessionState";

type UseDocumentEditorOptions = {
  sessionKey: string;
  defaultPaneMode?: EditorPaneMode;
  targetPath: string;
  requiresApproval: boolean;
  loadedContent: string;
  setLoadedContent: (content: string) => void;
  approvedBaseline: string;
  setApprovedBaseline: (baseline: string) => void;
  saveContent: (content: string, pendingSource: import("@/lib/draftApproval").DraftPendingSource | null) => Promise<void>;
  reloadAfterDiscard: () => Promise<string>;
  onError?: (message: string) => void;
  onApproved?: () => void | Promise<void>;
  onDiscarded?: (restored: string) => void;
};

export function useDocumentEditor(options: UseDocumentEditorOptions) {
  const {
    sessionKey,
    defaultPaneMode = "rendered",
    targetPath,
    requiresApproval,
    loadedContent,
    setLoadedContent,
    approvedBaseline,
    setApprovedBaseline,
    saveContent,
    reloadAfterDiscard,
    onError,
    onApproved,
    onDiscarded,
  } = options;

  const {
    value: content,
    setValue: setContent,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorHistory("");

  const {
    saveState,
    setSaveState,
    isDirty,
    isPendingApproval,
    pendingSource,
    setPendingSource,
    flushSave,
    handleApprove,
    handleDiscard,
  } = useDraftAutosave({
    targetPath,
    content,
    loadedContent,
    setLoadedContent,
    approvedBaseline,
    setApprovedBaseline,
    saveContent,
    reloadAfterDiscard,
    onError,
    onApproved,
    onDiscarded,
    requiresApproval,
  });

  useEditorDirty(isDirty);

  const { restore, persist } = usePersistedEditorSession(sessionKey);

  const applyFormat = useCallback(
    (action: MarkdownFormatAction, textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return;
      const { value, selectionStart, selectionEnd } = textarea;
      const result = applyMarkdownFormat(value, selectionStart, selectionEnd, action);
      setContent(result.value);
      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [setContent],
  );

  const onFormatShortcut = useCallback(
    (event: React.KeyboardEvent, textarea: HTMLTextAreaElement | null) =>
      handleFormatShortcut(event, (action) => applyFormat(action, textarea)),
    [applyFormat],
  );

  return {
    content,
    setContent,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    setSaveState,
    isDirty,
    isPendingApproval,
    pendingSource,
    setPendingSource,
    flushSave,
    handleApprove,
    handleDiscard,
    restore,
    persist,
    defaultPaneMode,
    applyFormat,
    onFormatShortcut,
  };
}

export type DocumentEditorState = ReturnType<typeof useDocumentEditor>;
