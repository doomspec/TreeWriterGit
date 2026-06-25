import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  extractMarkdownHeadings,
  filterDocumentOutlineHeadings,
  type MarkdownHeading,
} from "@/lib/markdownOutline";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";

export type DocumentOutlineState = {
  markdown: string;
  scrollContainer: HTMLElement | null;
  linkContextPath: string;
  headings: MarkdownHeading[];
  activeHeadingId: string | null;
  registerScrollContainer: (el: HTMLElement | null) => void;
  setMarkdown: (markdown: string) => void;
  setLinkContextPath: (path: string) => void;
  setActiveHeadingId: (id: string | null) => void;
  scrollToHeading: (id: string) => boolean;
  navigateHeading: (heading: MarkdownHeading, onNavigate: (target: NavigateTarget) => void) => boolean;
};

const DocumentOutlineContext = createContext<DocumentOutlineState | null>(null);

const OUTLINE_SCROLL_PADDING = 12;

export function findScrollableParent(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function scrollElementIntoScrollParent(
  target: HTMLElement,
  scrollParent: HTMLElement,
  padding = OUTLINE_SCROLL_PADDING,
): void {
  const parentRect = scrollParent.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextTop = scrollParent.scrollTop + (targetRect.top - parentRect.top) - padding;
  scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
}

export function DocumentOutlineProvider({ children }: { children: ReactNode }) {
  const [markdown, setMarkdown] = useState("");
  const [linkContextPath, setLinkContextPath] = useState("");
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);

  const headings = useMemo(
    () => filterDocumentOutlineHeadings(extractMarkdownHeadings(markdown)),
    [markdown],
  );

  const registerScrollContainer = useCallback((el: HTMLElement | null) => {
    setScrollContainer(el);
  }, []);

  const scrollToHeading = useCallback((id: string): boolean => {
    const escapedId = typeof CSS !== "undefined" && "escape" in CSS ? CSS.escape(id) : id;
    const target = document.querySelector(
      `[data-heading-id="${escapedId}"]`,
    ) as HTMLElement | null;
    if (!target) return false;

    const scrollParent = findScrollableParent(target);
    if (scrollParent) {
      scrollElementIntoScrollParent(target, scrollParent);
    } else {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    setActiveHeadingId(id);
    return true;
  }, []);

  const navigateHeading = useCallback(
    (heading: MarkdownHeading, onNavigate: (target: NavigateTarget) => void): boolean => {
      if (!heading.href || !linkContextPath) return false;
      const target = resolveNavigateTarget(linkContextPath, heading.href);
      if (!target) return false;
      onNavigate(target);
      setActiveHeadingId(heading.id);
      return true;
    },
    [linkContextPath],
  );

  const value = useMemo<DocumentOutlineState>(
    () => ({
      markdown,
      scrollContainer,
      linkContextPath,
      headings,
      activeHeadingId,
      registerScrollContainer,
      setMarkdown,
      setLinkContextPath,
      setActiveHeadingId,
      scrollToHeading,
      navigateHeading,
    }),
    [
      activeHeadingId,
      headings,
      linkContextPath,
      markdown,
      navigateHeading,
      registerScrollContainer,
      scrollContainer,
      scrollToHeading,
    ],
  );

  return (
    <DocumentOutlineContext.Provider value={value}>{children}</DocumentOutlineContext.Provider>
  );
}

export function useDocumentOutline(): DocumentOutlineState | null {
  return useContext(DocumentOutlineContext);
}

export function useDocumentOutlineRequired(): DocumentOutlineState {
  const ctx = useContext(DocumentOutlineContext);
  if (!ctx) throw new Error("useDocumentOutlineRequired must be used within DocumentOutlineProvider");
  return ctx;
}

/** Keep outline panel in sync with the active editor document. */
export function useSyncDocumentOutline(
  markdown: string,
  scrollRef: RefObject<HTMLElement | null>,
  enabled = true,
  linkContextPath = "",
): (el: HTMLElement | null) => void {
  const outline = useDocumentOutline();

  useEffect(() => {
    if (!outline || !enabled) return;
    outline.setMarkdown(markdown);
    outline.setLinkContextPath(linkContextPath);
    outline.registerScrollContainer(scrollRef.current);
  }, [enabled, linkContextPath, markdown, outline, scrollRef]);

  return useCallback(
    (el: HTMLElement | null) => {
      scrollRef.current = el;
      if (outline && enabled) {
        outline.registerScrollContainer(el);
      }
    },
    [enabled, outline, scrollRef],
  );
}
