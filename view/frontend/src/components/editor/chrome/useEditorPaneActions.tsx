import { useMemo } from "react";

import { TextZoomControl } from "@/components/editor/TextZoomControl";
import { markdownWordCount } from "@/lib/editorStats";
import { editorTextZoomStyle } from "@/lib/editorTextZoom";
import { useEditorTextZoom } from "@/lib/useEditorTextZoom";

/** Bundles text zoom controls and word counts shared by manuscript editors. */
export function useEditorPaneActions(content: string) {
  const { zoom, zoomIn, zoomOut, resetZoom } = useEditorTextZoom();
  const editorStats = useMemo(() => markdownWordCount(content), [content]);
  const textZoomStyle = editorTextZoomStyle(zoom);
  const textZoomControl = (
    <TextZoomControl zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
  );

  return {
    editorStats,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    textZoomStyle,
    textZoomControl,
  };
}
