import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import {
  clampInlineToolbarPosition,
  getSelectionBoundsInScope,
} from "@/lib/selectionBounds";
import { useSelectionInScope } from "@/lib/readingFocus";

export function useInlineSelectionToolbar(
  scopeRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): {
  visible: boolean;
  position: { top: number; left: number } | null;
  toolbarRef: RefObject<HTMLDivElement | null>;
} {
  const selectionVisible = useSelectionInScope(scopeRef, enabled);
  const visible = enabled && selectionVisible;
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }

    const update = () => {
      const bounds = getSelectionBoundsInScope(scopeRef.current);
      if (!bounds) {
        setPosition(null);
        return;
      }
      const toolbar = toolbarRef.current;
      const width = toolbar?.offsetWidth ?? 320;
      const height = toolbar?.offsetHeight ?? 36;
      setPosition(clampInlineToolbarPosition(bounds, width, height));
    };

    update();
    const raf = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(raf);
  }, [visible, scopeRef]);

  useEffect(() => {
    if (!visible) return;

    const update = () => {
      const bounds = getSelectionBoundsInScope(scopeRef.current);
      if (!bounds) {
        setPosition(null);
        return;
      }
      const toolbar = toolbarRef.current;
      const width = toolbar?.offsetWidth ?? 320;
      const height = toolbar?.offsetHeight ?? 36;
      setPosition(clampInlineToolbarPosition(bounds, width, height));
    };

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("selectionchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("selectionchange", update);
    };
  }, [visible, scopeRef]);

  return { visible, position, toolbarRef };
}
