import { useCallback, useEffect, useRef } from "react";

import {
  loadEditorSession,
  scheduleSaveEditorSession,
  type EditorPaneMode,
  type EditorSessionState,
} from "@/lib/editorSessionState";

export function usePersistedEditorSession(sessionKey: string) {
  const restoredRef = useRef(false);
  const pendingRestoreRef = useRef<EditorSessionState | null>(null);

  useEffect(() => {
    restoredRef.current = false;
    pendingRestoreRef.current = loadEditorSession(sessionKey);
  }, [sessionKey]);

  const initialPaneMode = pendingRestoreRef.current?.paneMode;

  const restore = useCallback(
    (
      textarea: HTMLTextAreaElement | null,
      scrollEl: HTMLElement | null,
      onPaneMode?: (mode: EditorPaneMode) => void,
    ) => {
      const saved = pendingRestoreRef.current;
      if (!saved || restoredRef.current) return;
      restoredRef.current = true;
      if (saved.paneMode && onPaneMode) onPaneMode(saved.paneMode);
      window.requestAnimationFrame(() => {
        if (textarea && saved.selectionStart != null) {
          const start = Math.min(saved.selectionStart, textarea.value.length);
          const end = Math.min(saved.selectionEnd ?? start, textarea.value.length);
          textarea.focus({ preventScroll: true });
          textarea.setSelectionRange(start, end);
        }
        if (scrollEl && saved.scrollTop != null) {
          scrollEl.scrollTop = saved.scrollTop;
        }
      });
    },
    [],
  );

  const persist = useCallback(
    (
      textarea: HTMLTextAreaElement | null,
      scrollEl: HTMLElement | null,
      paneMode?: EditorPaneMode,
    ) => {
      scheduleSaveEditorSession(sessionKey, {
        paneMode,
        selectionStart: textarea?.selectionStart,
        selectionEnd: textarea?.selectionEnd,
        scrollTop: scrollEl?.scrollTop,
      });
    },
    [sessionKey],
  );

  return { initialPaneMode, restore, persist };
}
