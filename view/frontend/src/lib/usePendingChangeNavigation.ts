import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearPendingChangeFocus,
  collectPendingChangeElements,
  focusPendingChangeElement,
  PENDING_CHANGE_FOCUS_CLASS,
} from "@/lib/pendingChangeNavigation";

export type PendingChangeNavigation = {
  count: number;
  /** 0-based active change index, or -1 when none selected */
  index: number;
  canNavigate: boolean;
  goToNext: () => void;
  goToPrevious: () => void;
};

export function usePendingChangeNavigation(
  getRoot: () => HTMLElement | null,
  enabled: boolean,
  refreshKey: string | number = "",
): PendingChangeNavigation {
  const elementsRef = useRef<HTMLElement[]>([]);
  const indexRef = useRef(-1);
  const [state, setState] = useState({ index: -1, count: 0 });

  const refresh = useCallback(() => {
    const root = getRoot();
    if (!root || !enabled) {
      clearPendingChangeFocus(root);
      elementsRef.current = [];
      indexRef.current = -1;
      setState({ index: -1, count: 0 });
      return;
    }

    const elements = collectPendingChangeElements(root);
    elementsRef.current = elements;

    for (const element of root.querySelectorAll<HTMLElement>(`.${PENDING_CHANGE_FOCUS_CLASS}`)) {
      if (!elements.includes(element)) {
        element.classList.remove(PENDING_CHANGE_FOCUS_CLASS);
      }
    }

    if (elements.length === 0) {
      indexRef.current = -1;
      setState({ index: -1, count: 0 });
      return;
    }

    const nextIndex =
      indexRef.current >= 0 && indexRef.current < elements.length ? indexRef.current : -1;
    indexRef.current = nextIndex;
    setState({ index: nextIndex, count: elements.length });
  }, [enabled, getRoot]);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const root = getRoot();
      const elements = elementsRef.current;
      if (!root || elements.length === 0) return;

      clearPendingChangeFocus(root);
      const wrapped =
        ((nextIndex % elements.length) + elements.length) % elements.length;
      const target = elements[wrapped];
      if (!target) return;

      focusPendingChangeElement(target, root);
      indexRef.current = wrapped;
      setState({ index: wrapped, count: elements.length });
    },
    [getRoot],
  );

  const goToNext = useCallback(() => {
    const elements = elementsRef.current;
    if (elements.length === 0) return;
    const next = indexRef.current < 0 ? 0 : (indexRef.current + 1) % elements.length;
    goToIndex(next);
  }, [goToIndex]);

  const goToPrevious = useCallback(() => {
    const elements = elementsRef.current;
    if (elements.length === 0) return;
    const next =
      indexRef.current < 0
        ? elements.length - 1
        : (indexRef.current - 1 + elements.length) % elements.length;
    goToIndex(next);
  }, [goToIndex]);

  useEffect(() => {
    refresh();
    const root = getRoot();
    if (!root || !enabled) return;

    const observer = new MutationObserver(() => refresh());
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      clearPendingChangeFocus(root);
    };
  }, [enabled, getRoot, refresh, refreshKey]);

  return {
    count: state.count,
    index: state.index,
    canNavigate: state.count > 0,
    goToNext,
    goToPrevious,
  };
}
