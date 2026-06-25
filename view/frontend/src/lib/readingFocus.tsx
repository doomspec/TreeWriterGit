import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type ReadingFocusContextValue = {
  active: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
  extraChrome: ReactNode;
  setExtraChrome: (node: ReactNode) => void;
};

const ReadingFocusContext = createContext<ReadingFocusContextValue | null>(null);

const STORAGE_KEY = "treewriter.readingFocus.v1";

const noopFocusContext: ReadingFocusContextValue = {
  active: false,
  enter: () => {},
  exit: () => {},
  toggle: () => {},
  extraChrome: null,
  setExtraChrome: () => {},
};

export function ReadingFocusProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [extraChrome, setExtraChromeState] = useState<ReactNode>(null);

  const persist = useCallback((next: boolean) => {
    startTransition(() => {
      setActive(next);
    });
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const enter = useCallback(() => persist(true), [persist]);
  const exit = useCallback(() => persist(false), [persist]);
  const toggle = useCallback(() => persist(!active), [active, persist]);
  const setExtraChrome = useCallback((node: ReactNode) => {
    setExtraChromeState((prev) => (Object.is(prev, node) ? prev : node));
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, exit]);

  const value = useMemo(
    () => ({ active, enter, exit, toggle, extraChrome, setExtraChrome }),
    [active, enter, exit, extraChrome, setExtraChrome, toggle],
  );

  return <ReadingFocusContext.Provider value={value}>{children}</ReadingFocusContext.Provider>;
}

export function useReadingFocus(): ReadingFocusContextValue {
  const ctx = useContext(ReadingFocusContext);
  return ctx ?? noopFocusContext;
}

/** True when the user has a non-empty text selection or an active caret inside `scope`. */
export function selectionVisibleInScope(scope: HTMLElement | null): boolean {
  if (!scope) return false;

  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement && scope.contains(active)) {
    return true;
  }

  if (active instanceof HTMLElement && active.isContentEditable && scope.contains(active)) {
    return true;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  const inScope =
    (anchor != null && scope.contains(anchor)) || (focus != null && scope.contains(focus));
  if (!inScope) return false;

  if (!selection.isCollapsed && selection.toString().trim()) {
    return true;
  }

  const node = anchor ?? focus;
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  const editable = element?.closest("[contenteditable=''], [contenteditable='true']");
  return Boolean(editable && scope.contains(editable));
}

/** Portaled controls opened from the floating inline editor toolbar. */
export function isInlineEditorToolbarTarget(target: EventTarget | null): boolean {
  const element =
    target instanceof Element
      ? target
      : document.activeElement instanceof Element
        ? document.activeElement
        : null;
  if (!element) return false;
  return Boolean(
    element.closest(".inline-selection-toolbar") ||
    element.closest(".asset-insert-menu") ||
    element.closest("[data-editor-floating-chrome]"),
  );
}

export function hasOpenInlineEditorPopover(): boolean {
  return Boolean(document.querySelector("[data-editor-floating-chrome]"));
}

function hasActiveSelectionInScope(scope: HTMLElement | null): boolean {
  if (!scope) return false;

  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement && scope.contains(active)) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    return start !== end && active.value.slice(start, end).trim().length > 0;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;

  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  return (
    (anchor != null && scope.contains(anchor)) || (focus != null && scope.contains(focus))
  );
}

/** True when the user has a non-empty text selection or an active caret inside `scope`. */
export function useSelectionInScope(
  scopeRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }

    setVisible(false);

    const eventInScope = (event: Event): boolean => {
      const scope = scopeRef.current;
      const target = event.target;
      return Boolean(scope && target instanceof Node && scope.contains(target));
    };

    const hideIfEmpty = () => {
      if (isInlineEditorToolbarTarget(null) || hasOpenInlineEditorPopover()) return;
      if (!selectionVisibleInScope(scopeRef.current)) {
        setVisible(false);
      }
    };

    const revealAfterSelection = () => {
      if (isInlineEditorToolbarTarget(null) || hasOpenInlineEditorPopover()) {
        setVisible(true);
        return;
      }
      setVisible(selectionVisibleInScope(scopeRef.current));
    };

    const onSelectionStart = (event: Event) => {
      if (isInlineEditorToolbarTarget(event.target)) return;
      if (!eventInScope(event)) return;
      if (!hasActiveSelectionInScope(scopeRef.current)) return;
      setVisible(false);
    };

    const onSelectionComplete = (event: Event) => {
      if (!eventInScope(event)) return;
      revealAfterSelection();
    };

    document.addEventListener("mousedown", onSelectionStart);
    document.addEventListener("touchstart", onSelectionStart, { passive: true });
    document.addEventListener("mouseup", onSelectionComplete);
    document.addEventListener("touchend", onSelectionComplete);
    document.addEventListener("keyup", onSelectionComplete);
    document.addEventListener("selectionchange", hideIfEmpty);

    return () => {
      document.removeEventListener("mousedown", onSelectionStart);
      document.removeEventListener("touchstart", onSelectionStart);
      document.removeEventListener("mouseup", onSelectionComplete);
      document.removeEventListener("touchend", onSelectionComplete);
      document.removeEventListener("keyup", onSelectionComplete);
      document.removeEventListener("selectionchange", hideIfEmpty);
    };
  }, [enabled, scopeRef]);

  return visible;
}
