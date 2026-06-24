import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useDocumentOutline } from "@/lib/documentOutline";
import type { MarkdownHeading } from "@/lib/markdownOutline";
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider";

export function DocumentOutlinePanel({ className }: { className?: string }) {
  const outline = useDocumentOutline();
  const ws = useWorkspace();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const headings = outline?.headings ?? [];
  const activeId = outline?.activeHeadingId ?? null;

  const handleNavigate = useCallback(
    (heading: MarkdownHeading) => {
      if (!outline) return;
      if (outline.scrollToHeading(heading.id)) return;
      outline.navigateHeading(heading, (target) => {
        if (target.type === "file") {
          ws.openFile(target.path);
          return;
        }
        ws.navigateTo(target.path);
      });
    },
    [outline, ws],
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
