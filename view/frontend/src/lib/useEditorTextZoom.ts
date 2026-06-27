import { useCallback, useEffect, useState } from "react";

import {
  EDITOR_TEXT_ZOOM_DEFAULT,
  loadEditorTextZoom,
  saveEditorTextZoom,
  stepEditorTextZoom,
} from "@/lib/editorTextZoom";

export function useEditorTextZoom() {
  const [zoom, setZoomState] = useState(loadEditorTextZoom);

  const setZoom = useCallback((next: number | ((prev: number) => number)) => {
    setZoomState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      saveEditorTextZoom(value);
      return value;
    });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((prev) => stepEditorTextZoom(prev, "in"));
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => stepEditorTextZoom(prev, "out"));
  }, [setZoom]);

  const resetZoom = useCallback(() => {
    setZoom(EDITOR_TEXT_ZOOM_DEFAULT);
  }, [setZoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest(".editor-text-zoom-root")) return;

      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        zoomIn();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomOut();
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetZoom, zoomIn, zoomOut]);

  return { zoom, setZoom, zoomIn, zoomOut, resetZoom };
}
