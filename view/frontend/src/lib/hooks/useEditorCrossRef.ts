import { useEffect, useState } from "react";

import type { FigureMetadata } from "@/lib/figures";
import { figureLabelIndexFromCrossRef } from "@/lib/figureLabelIndex";
import { fetchCrossRefIndex } from "@/lib/paperAssets";

export function useEditorCrossRef(paperPath: string | null | undefined, refreshVersion: number) {
  const [figureLabelIndex, setFigureLabelIndex] = useState(() => new Map<string, FigureMetadata>());

  useEffect(() => {
    if (!paperPath) {
      setFigureLabelIndex(new Map());
      return;
    }
    let cancelled = false;
    void fetchCrossRefIndex(paperPath)
      .then((index) => {
        if (!cancelled) setFigureLabelIndex(figureLabelIndexFromCrossRef(index));
      })
      .catch(() => {
        if (!cancelled) setFigureLabelIndex(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [paperPath, refreshVersion]);

  return figureLabelIndex;
}
