import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
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

  useEffect(() => {
    if (!active) setExtraChromeState(null);
  }, [active]);

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
