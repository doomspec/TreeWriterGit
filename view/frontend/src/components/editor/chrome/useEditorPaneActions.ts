import { useEditorHistory } from "@/lib/useEditorHistory";
import { useEditorTextZoom } from "@/lib/useEditorTextZoom";

/** Bundles undo/redo and text zoom controls shared by manuscript editors. */
export function useEditorPaneActions(content: string, setContent: (value: string) => void) {
  const { canUndo, canRedo, undo, redo, editorStats } = useEditorHistory(content, setContent);
  const { zoom, zoomIn, zoomOut, resetZoom, textZoomStyle, textZoomControl } = useEditorTextZoom();

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    editorStats,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    textZoomStyle,
    textZoomControl,
  };
}
