import { useCallback, useMemo, useRef, useState } from "react";

import { createEditorHistory } from "./editorHistoryCore";

export function useEditorHistory(initialValue: string) {
  const coreRef = useRef(createEditorHistory(initialValue));
  const [value, setValueState] = useState(initialValue);
  const [revision, setRevision] = useState(0);

  const bump = useCallback(() => {
    setValueState(coreRef.current.getValue());
    setRevision((v) => v + 1);
  }, []);

  const setValue = useCallback(
    (next: string) => {
      coreRef.current.setValue(next);
      bump();
    },
    [bump],
  );

  const resetHistory = useCallback(
    (next: string) => {
      if (coreRef.current.getValue() === next) return;
      coreRef.current.resetHistory(next);
      bump();
    },
    [bump],
  );

  const undo = useCallback(() => {
    const changed = coreRef.current.undo();
    if (changed) bump();
    return changed;
  }, [bump]);

  const redo = useCallback(() => {
    const changed = coreRef.current.redo();
    if (changed) bump();
    return changed;
  }, [bump]);

  const flushHistory = useCallback(() => {
    coreRef.current.flushHistory();
    bump();
  }, [bump]);

  const canUndo = useMemo(() => {
    void revision;
    return coreRef.current.canUndo();
  }, [revision]);

  const canRedo = useMemo(() => {
    void revision;
    return coreRef.current.canRedo();
  }, [revision]);

  return {
    value,
    setValue,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    revision,
    flushHistory,
  };
}
