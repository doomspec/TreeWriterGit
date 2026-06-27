const GROUP_MS = 400;
const MAX_ENTRIES = 100;

export type EditorHistoryCore = {
  getValue: () => string;
  setValue: (next: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  resetHistory: (next: string) => void;
  flushHistory: () => void;
};

export function createEditorHistory(initialValue: string): EditorHistoryCore {
  let value = initialValue;
  let committed = initialValue;
  let pending: string | null = null;
  const past: string[] = [];
  const future: string[] = [];
  let groupTimer: ReturnType<typeof setTimeout> | null = null;
  let skipRecord = false;

  const canUndo = () =>
    past.length > 0 || (pending !== null && pending !== committed);
  const canRedo = () => future.length > 0;

  const commitPending = () => {
    if (groupTimer !== null) {
      clearTimeout(groupTimer);
      groupTimer = null;
    }
    if (pending === null || pending === committed) {
      pending = null;
      return;
    }
    past.push(committed);
    if (past.length > MAX_ENTRIES) past.shift();
    future.length = 0;
    committed = pending;
    pending = null;
  };

  const resetHistory = (next: string) => {
    if (groupTimer !== null) {
      clearTimeout(groupTimer);
      groupTimer = null;
    }
    pending = null;
    past.length = 0;
    future.length = 0;
    committed = next;
    skipRecord = false;
    value = next;
  };

  const setValue = (next: string) => {
    if (skipRecord) {
      skipRecord = false;
      committed = next;
      pending = null;
      value = next;
      return;
    }

    value = next;
    pending = next;

    if (groupTimer !== null) {
      clearTimeout(groupTimer);
    }
    groupTimer = setTimeout(() => {
      groupTimer = null;
      commitPending();
    }, GROUP_MS);
  };

  const undo = () => {
    commitPending();
    if (past.length === 0) return false;

    future.unshift(committed);
    const previous = past.pop()!;
    skipRecord = true;
    committed = previous;
    pending = null;
    value = previous;
    return true;
  };

  const redo = () => {
    commitPending();
    if (future.length === 0) return false;

    past.push(committed);
    const next = future.shift()!;
    skipRecord = true;
    committed = next;
    pending = null;
    value = next;
    return true;
  };

  return {
    getValue: () => value,
    setValue,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    flushHistory: commitPending,
  };
}
