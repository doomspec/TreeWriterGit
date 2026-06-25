import { useCallback, useEffect, useState } from "react";

import {
  loadEditorSession,
  saveEditorSession,
  type EditorPaneMode,
} from "@/lib/editorSessionState";

export function useEditorPaneMode(
  sessionKey: string,
  defaultMode: EditorPaneMode = "rendered",
): {
  paneMode: EditorPaneMode;
  setPaneMode: (mode: EditorPaneMode) => void;
} {
  const [paneMode, setPaneModeState] = useState<EditorPaneMode>(() => {
    const saved = loadEditorSession(sessionKey);
    return saved?.paneMode ?? defaultMode;
  });

  const setPaneMode = useCallback((mode: EditorPaneMode) => {
    setPaneModeState(mode);
  }, []);

  useEffect(() => {
    saveEditorSession(sessionKey, { paneMode });
  }, [paneMode, sessionKey]);

  return { paneMode, setPaneMode };
}

export function useActiveOutlineNavPath(
  linkContextPath: string,
  activeFile: string | null,
  browsePath: string,
  isOutlineFile: boolean,
): string | null {
  if (!isOutlineFile) return null;
  const focus = activeFile ? focusParent(activeFile) : browsePath;
  const context = linkContextPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedFocus = focus.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalizedFocus || normalizedFocus === context) return null;
  return normalizedFocus;
}

function focusParent(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : normalized;
}
