import { useEffect, useState, type RefObject } from "react";

import {
  getSelectionEditorTarget,
  type EditorPaneTarget,
} from "@/lib/selectionBounds";

export function useSelectionEditorTarget(
  scopeRef: RefObject<HTMLElement | null>,
  sourceRootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  fallback: EditorPaneTarget = "preview",
): EditorPaneTarget {
  const [target, setTarget] = useState<EditorPaneTarget>(fallback);

  useEffect(() => {
    if (!enabled) {
      setTarget(fallback);
      return;
    }

    const update = () => {
      setTarget(getSelectionEditorTarget(scopeRef.current, sourceRootRef.current, fallback));
    };

    update();
    document.addEventListener("selectionchange", update);
    document.addEventListener("mouseup", update);
    document.addEventListener("keyup", update);

    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("mouseup", update);
      document.removeEventListener("keyup", update);
    };
  }, [enabled, fallback, scopeRef, sourceRootRef]);

  return target;
}
