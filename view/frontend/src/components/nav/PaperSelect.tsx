import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PaperSummary } from "@/modelApi";

export function paperSlugFromPath(path: string): string | null {
  return /^papers\/([^/]+)/.exec(path)?.[1] ?? null;
}

export function PaperSelect({
  papers,
  selectedSlug,
  loading,
  onChange,
  className,
}: {
  papers: PaperSummary[];
  selectedSlug: string | null;
  loading: boolean;
  onChange: (slug: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const selected = papers.find((p) => p.slug === selectedSlug);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const label = selected
    ? `${selected.title}${selected.journal ? ` · ${selected.journal}` : ""}`
    : papers.length === 0
      ? "No papers yet"
      : "Select a paper…";

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        id="paper-select"
        disabled={loading && papers.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select paper"
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-left text-xs outline-none ring-primary focus-visible:ring-1",
          loading ? "opacity-60" : undefined,
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && menuPosition
        ? createPortal(
            <ul
              ref={menuRef}
              role="listbox"
              aria-labelledby="paper-select"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
              className="fixed z-overlay max-h-48 overflow-auto rounded-md border border-border bg-card py-1 text-card-foreground shadow-xl"
            >
              {papers.length === 0 ? (
                <li className="bg-card px-2.5 py-2 text-xs text-muted-foreground">No papers yet</li>
              ) : (
                papers.map((paper) => {
                  const active = paper.slug === selectedSlug;
                  return (
                    <li key={paper.slug} role="option" aria-selected={active} className="bg-card">
                      <button
                        type="button"
                        className={cn(
                          "flex w-full flex-col items-start bg-card px-2.5 py-1.5 text-left text-xs hover:bg-accent",
                          active && "bg-accent font-medium",
                        )}
                        onClick={() => {
                          onChange(paper.slug);
                          setOpen(false);
                        }}
                      >
                        <span className="line-clamp-2">{paper.title}</span>
                        {paper.journal ? (
                          <span className="text-[10px] text-muted-foreground">{paper.journal}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
