import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import {
  clampInlineToolbarPosition,
  getSelectionBoundsInScope,
} from "@/lib/selectionBounds";
import { useSelectionInScope } from "@/lib/readingFocus";

/** Idle time (ms) with no reading/scrolling/typing activity before the toolbar fades. */
const FADE_IDLE_MS = 2200;

export function useInlineSelectionToolbar(
  scopeRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): {
  visible: boolean;
  position: { top: number; left: number } | null;
  /** True once the toolbar has been idle long enough to fade out of the reader's way. */
  faded: boolean;
  toolbarRef: RefObject<HTMLDivElement | null>;
} {
  const selectionVisible = useSelectionInScope(scopeRef, enabled);
  const visible = enabled && selectionVisible;
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [faded, setFaded] = useState(false);
  const fadedRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const measure = () => {
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

  const resetIdle = () => {
    if (fadedRef.current) {
      fadedRef.current = false;
      setFaded(false);
    }
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      fadedRef.current = true;
      setFaded(true);
    }, FADE_IDLE_MS);
  };

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null);
      fadedRef.current = false;
      setFaded(false);
      return;
    }
    measure();
    resetIdle();
    const raf = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scopeRef]);

  useEffect(() => {
    if (!visible) return;

    // A rAF loop (rather than only 'scroll'/'resize' events) keeps the
    // fixed-position toolbar glued to the selection even when the ancestor
    // scrolls via a mechanism that doesn't dispatch native scroll events
    // (e.g. a transform-driven or programmatic scroller).
    let raf = 0;
    const tick = () => {
      measure();
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    const onActivity = () => resetIdle();
    document.addEventListener("selectionchange", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("wheel", onActivity, { passive: true });

    return () => {
      window.cancelAnimationFrame(raf);
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
      document.removeEventListener("selectionchange", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("wheel", onActivity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scopeRef]);

  return { visible, position, faded, toolbarRef };
}
