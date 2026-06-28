import { useCallback, useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";
import { useDocumentOutline } from "@/lib/documentOutline";
import type { MarkdownHeading } from "@/lib/markdownOutline";
import { hasNavigableOutlineEntries } from "@/lib/markdownOutline";
import { applyOutlineHeadingLevelsFromModel } from "@/lib/outlineHeadingLevels";
import { findActiveOutlineHeadingId } from "@/lib/outlineActiveNav";
import {
  orderedChildFolders,
  sectionsForPaper,
  parentPath,
  type ModelNode,
} from "@/lib/modelTree";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";

function buildModelOutlineHeadings(
  tree: ModelNode[],
  folderPath: string,
  childOrder: string[],
  paperPath: string | null,
  titleLevel: number | null,
): MarkdownHeading[] {
  const items =
    paperPath && folderPath === paperPath
      ? sectionsForPaper(tree, paperPath, childOrder)
      : orderedChildFolders(tree, folderPath, childOrder);
  if (items.length === 0) return [];

  const level = titleLevel ?? 1;
  return items.map((item) => ({
    id: `model-${item.path}`,
    level,
    text: item.title,
    lineIndex: -1,
    href: `${item.name}/INDEX.md`,
  }));
}

function mergeOutlineHeadings(
  markdownHeadings: MarkdownHeading[],
  modelHeadings: MarkdownHeading[],
): MarkdownHeading[] {
  if (modelHeadings.length === 0) return markdownHeadings;

  const title = markdownHeadings.find((heading) => heading.level === 1);
  if (title) return [title, ...modelHeadings];
  return modelHeadings;
}

export function DocumentOutlinePanel({ className }: { className?: string }) {
  const outline = useDocumentOutline();
  const nav = useWorkspaceNavigationContext();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const linkContextPath = outline?.linkContextPath ?? "";
  const childOrders = nav.paperChildOrders;
  const childOrder = childOrders[linkContextPath] ?? [];

  const markdownHeadings = outline?.headings ?? [];

  useEffect(() => {
    if (!linkContextPath || !nav.treeLoaded) return;
    void nav.loadTreePath(linkContextPath);
  }, [linkContextPath, nav.loadTreePath, nav.refreshVersion, nav.treeLoaded]);

  const headings = useMemo(() => {
    let result = markdownHeadings;
    if (linkContextPath && !hasNavigableOutlineEntries(markdownHeadings)) {
      const title = markdownHeadings.find((heading) => heading.level === 1) ?? null;
      const modelHeadings = buildModelOutlineHeadings(
        nav.tree,
        linkContextPath,
        childOrder,
        nav.paperPath,
        title?.level ?? null,
      );
      result = mergeOutlineHeadings(markdownHeadings, modelHeadings);
    }
    if (linkContextPath && result.some((heading) => heading.href)) {
      result = applyOutlineHeadingLevelsFromModel(result, nav.tree, linkContextPath);
    }
    return result;
  }, [childOrder, linkContextPath, markdownHeadings, nav.paperPath, nav.tree]);

  const focusPath = nav.activeFile ? parentPath(nav.activeFile) : nav.browsePath;
  const locationActiveId = useMemo(
    () => findActiveOutlineHeadingId(headings, linkContextPath, focusPath),
    [focusPath, headings, linkContextPath],
  );
  const scrollActiveId = outline?.activeHeadingId ?? null;
  const activeId = locationActiveId ?? scrollActiveId;

  const handleNavigate = useCallback(
    (heading: MarkdownHeading) => {
      if (!outline) return;
      if (outline.scrollToHeading(heading.id)) return;
      outline.navigateHeading(heading, (target) => {
        if (target.type === "file") {
          nav.openFile(target.path);
          return;
        }
        nav.navigateTo(target.path);
      });
    },
    [nav, outline],
  );

  useEffect(() => {
    if (!outline?.scrollContainer || headings.length === 0) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const container = outline.scrollContainer;
    const headingElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-heading-id]"),
    );
    if (headingElements.length === 0) return;

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0]?.target as HTMLElement | undefined;
        const id = top?.getAttribute("data-heading-id");
        if (id) outline.setActiveHeadingId(id);
      },
      {
        root: container,
        rootMargin: "-10% 0px -75% 0px",
        threshold: 0,
      },
    );

    for (const el of headingElements) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [headings, outline]);

  if (!outline) {
    return (
      <div className={cn("p-3 text-xs text-muted-foreground", className)}>
        Open a document to see its outline.
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div className={cn("p-3 text-xs text-muted-foreground", className)}>
        No headings in the current document.
      </div>
    );
  }

  const minLevel = Math.min(...headings.map((heading) => heading.level));

  return (
    <nav
      className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2", className)}
      aria-label="Document outline"
    >
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Outline
      </p>
      <ul className="space-y-0.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <button
              type="button"
              className={cn(
                "ui-nav-row",
                activeId === heading.id && "ui-nav-row-active",
              )}
              style={{
                paddingInlineStart: `${(heading.level - minLevel) * 0.65 + 0.5}rem`,
              }}
              title={heading.text}
              aria-current={activeId === heading.id ? "location" : undefined}
              onClick={() => handleNavigate(heading)}
            >
              <span className="truncate">{heading.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
