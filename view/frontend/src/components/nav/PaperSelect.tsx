import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocumentType, PaperSummary } from "@/modelApi";
import { DOC_TYPE_LABELS } from "@/lib/manuscriptForm";

export function docTypeBadgeLabel(docType: DocumentType | undefined): string {
  return DOC_TYPE_LABELS[docType ?? "paper"];
}

export function paperSlugFromPath(path: string): string | null {
  return /^papers\/([^/]+)/.exec(path)?.[1] ?? null;
}

export function paperRootFromPath(path: string): string | null {
  const slug = paperSlugFromPath(path);
  return slug ? `papers/${slug}` : null;
}

export function PaperSelect({
  papers,
  selectedSlug,
  loading,
  onChange,
  docTypeFilter = "all",
  className,
}: {
  papers: PaperSummary[];
  selectedSlug: string | null;
  loading: boolean;
  onChange: (slug: string) => void;
  docTypeFilter?: DocumentType | "all";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(
    null,
  );
  const filteredPapers =
    docTypeFilter === "all" ? papers : papers.filter((p) => (p.docType ?? "paper") === docTypeFilter);
  const queryNorm = query.trim().toLowerCase();
  const visiblePapers = queryNorm
    ? filteredPapers.filter((paper) => paper.title.toLowerCase().includes(queryNorm))
    : filteredPapers;
  const selected = filteredPapers.find((p) => p.slug === selectedSlug) ?? papers.find((p) => p.slug === selectedSlug);

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

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    searchInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    // The trigger button stays mounted but goes `display: none` when the
    // sidebar hover-collapses (see .workspace-sidebar-shell__panel--overlay) —
    // that doesn't fire resize/scroll, so the portal-rendered menu would
    // otherwise keep floating at its last position with no visible trigger.
    if (!open) return;
    const button = buttonRef.current;
    if (!button) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setOpen(false);
    });
    observer.observe(button);
    return () => observer.disconnect();
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = rootRef.current ?? buttonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const top = rect.bottom + 4;
      const bottomPadding = 8;
      setMenuPosition({
        top,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, window.innerHeight - top - bottomPadding),
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
    ? `${selected.title} · ${docTypeBadgeLabel(selected.docType)}`
    : filteredPapers.length === 0
      ? "No manuscripts yet"
      : "Select a manuscript…";

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        id="paper-select"
        disabled={loading && papers.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select manuscript"
        className={cn(
          "flex h-7 w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 text-left text-[11px] outline-none ring-primary focus-visible:ring-1",
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
                maxHeight: menuPosition.maxHeight,
              }}
              className="fixed z-overlay overflow-auto rounded-md border border-border bg-card py-1 text-card-foreground shadow-lg"
            >
              <li className="sticky top-0 z-10 bg-card px-2 pb-1 pt-1">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search titles…"
                  aria-label="Search paper titles"
                  className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none ring-primary focus-visible:ring-1"
                  onKeyDown={(event) => event.stopPropagation()}
                />
              </li>
              {visiblePapers.length === 0 ? (
                <li className="bg-card px-2.5 py-2 text-xs text-muted-foreground">No matching manuscripts</li>
              ) : (
                visiblePapers.map((paper) => {
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
                        <span className="text-[10px] text-muted-foreground">
                          {docTypeBadgeLabel(paper.docType)}
                        </span>
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
