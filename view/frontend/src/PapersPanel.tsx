import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, GripVertical, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  childrenOf,
  indexPathFor,
  orderedChildFolders,
  parseIndexFrontmatter,
  sectionsForPaper,
  type ModelNode,
  type PaperSectionItem,
} from "@/lib/modelTree";
import {
  fetchPaperDetail,
  fetchPapers,
  reorderChildren,
  type PaperDetail,
  type PaperSummary,
  type UnitStatusCounts,
} from "@/modelApi";
import { NewPaperModal } from "@/NewPaperModal";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type SectionRow = PaperSectionItem & {
  counts?: UnitStatusCounts;
};

function CountsLine({ counts }: { counts: UnitStatusCounts }) {
  return (
    <span className="font-mono text-[10px] text-muted-foreground">
      {counts.approved}a · {counts.drafted}d · {counts.outline}o
    </span>
  );
}

function paperSlugFromPath(path: string): string | null {
  return /^papers\/([^/]+)/.exec(path)?.[1] ?? null;
}

function PaperSelect({
  papers,
  selectedSlug,
  loading,
  onChange,
}: {
  papers: PaperSummary[];
  selectedSlug: string | null;
  loading: boolean;
  onChange: (slug: string) => void;
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
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        id="paper-select"
        disabled={loading && papers.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-left text-xs outline-none ring-primary focus-visible:ring-1",
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

function SubsectionOrderList({
  parent,
  subsections,
  currentPath,
  tree,
  childOrders,
  reordering,
  onNavigate,
  onReorder,
}: {
  parent: SectionRow;
  subsections: PaperSectionItem[];
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  reordering: boolean;
  onNavigate: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDrop = async (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...subsections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(toIndex, 0, moved);
    setDragIndex(null);
    setOverIndex(null);
    await onReorder(parent.path, next.map((c) => c.name));
  };

  return (
    <ul className="ml-6 space-y-0.5 border-l border-border/60 pl-2" aria-label={`Subsections of ${parent.title}`}>
      {subsections.map((child, index) => {
        const childActive = currentPath === child.path || currentPath.startsWith(`${child.path}/`);
        const nested = orderedChildFolders(tree, child.path, childOrders[child.path] ?? []);
        const showNested = childActive && nested.length > 0;

        return (
          <li key={child.path}>
            <div
              className={cn(
                "flex items-stretch gap-0.5 rounded-md",
                dragIndex === index ? "opacity-50" : undefined,
                overIndex === index && dragIndex !== null && dragIndex !== index
                  ? "ring-1 ring-primary/40"
                  : undefined,
                reordering ? "pointer-events-none opacity-60" : undefined,
              )}
            >
              <div
                draggable={!reordering}
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDrop(index);
                }}
                className="flex w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                title="Drag to reorder subsection"
                aria-hidden="true"
              >
                <GripVertical className="h-3 w-3" />
              </div>
              <button
                type="button"
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-accent/40",
                  childActive ? "bg-accent/50 font-medium text-foreground" : "text-muted-foreground",
                )}
                onClick={() => onNavigate(child.path)}
              >
                <span className="truncate">{child.title}</span>
              </button>
            </div>
            {showNested ? (
              <ul className="ml-3 space-y-0.5 border-l border-border/40 pl-2">
                {nested.map((unit) => {
                  const unitActive =
                    currentPath === unit.path || currentPath.startsWith(`${unit.path}/`);
                  return (
                    <li key={unit.path}>
                      <button
                        type="button"
                        className={cn(
                          "w-full truncate rounded-md px-2 py-0.5 text-left text-[10px] hover:bg-accent/40",
                          unitActive ? "bg-accent/40 font-medium" : "text-muted-foreground",
                        )}
                        onClick={() => onNavigate(unit.path)}
                      >
                        {unit.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SectionOrderList({
  sections,
  currentPath,
  tree,
  childOrders,
  reordering,
  onNavigate,
  onReorder,
  onChildReorder,
}: {
  sections: SectionRow[];
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  reordering: boolean;
  onNavigate: (path: string) => void;
  onReorder: (order: string[]) => Promise<void>;
  onChildReorder: (parentPath: string, order: string[]) => Promise<void>;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDrop = async (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...sections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(toIndex, 0, moved);
    setDragIndex(null);
    setOverIndex(null);
    await onReorder(next.map((s) => s.name));
  };

  const renderChildren = (parent: SectionRow) => {
    const expanded =
      currentPath === parent.path || currentPath.startsWith(`${parent.path}/`);
    if (!expanded) return null;

    const children = orderedChildFolders(tree, parent.path, childOrders[parent.path] ?? []);
    if (children.length === 0) {
      return (
        <li className="ml-6 border-l border-border/60 pl-2">
          <p className="px-2 py-1 text-[10px] text-muted-foreground">No subsections</p>
        </li>
      );
    }

    return (
      <SubsectionOrderList
        parent={parent}
        subsections={children}
        currentPath={currentPath}
        tree={tree}
        childOrders={childOrders}
        reordering={reordering}
        onNavigate={onNavigate}
        onReorder={onChildReorder}
      />
    );
  };

  return (
    <ul className="space-y-1" aria-label="Paper sections">
      {sections.map((section, index) => {
        const active =
          currentPath === section.path || currentPath.startsWith(`${section.path}/`);
        return (
          <li key={section.path}>
            <div
              className={cn(
                "flex items-stretch gap-1 rounded-md border border-border/60 bg-background transition-colors",
                active ? "border-primary/40 bg-accent/50" : undefined,
                dragIndex === index ? "opacity-50" : undefined,
                overIndex === index && dragIndex !== null && dragIndex !== index
                  ? "border-primary ring-1 ring-primary/30"
                  : undefined,
                reordering ? "pointer-events-none opacity-60" : undefined,
              )}
            >
              <div
                draggable={!reordering}
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDrop(index);
                }}
                className="flex w-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                title="Drag to reorder"
                aria-hidden="true"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/30"
                onClick={() => onNavigate(section.path)}
              >
                <span className="truncate font-medium">{section.title}</span>
                {section.counts ? (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {section.counts.approved}/{section.counts.drafted}/{section.counts.outline}
                  </span>
                ) : null}
              </button>
            </div>
            {renderChildren(section)}
          </li>
        );
      })}
    </ul>
  );
}

export function PapersPanel({
  tree,
  currentPath,
  refreshVersion,
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
  embedded = false,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion?: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged?: () => void;
  onError: (message: string) => void;
  embedded?: boolean;
}) {
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [detail, setDetail] = useState<PaperDetail | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [childOrders, setChildOrders] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [showNewPaper, setShowNewPaper] = useState(false);

  const selectedSlug = useMemo(() => paperSlugFromPath(currentPath), [currentPath]);
  const paperPath = selectedSlug ? `papers/${selectedSlug}` : null;

  const loadChildOrder = useCallback(async (path: string): Promise<string[]> => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/model/file?path=${encodeURIComponent(indexPathFor(path))}`,
      );
      if (!response.ok) return [];
      const data = (await response.json()) as { content: string };
      return parseIndexFrontmatter(data.content).childOrder;
    } catch {
      return [];
    }
  }, []);

  const loadSectionOrder = useCallback(
    async (path: string) => {
      const order = await loadChildOrder(path);
      setSectionOrder(order);
      return order;
    },
    [loadChildOrder],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const list = await fetchPapers();
        setPapers(list.papers);
      } catch {
        const paperNodes = childrenOf(tree, "papers").filter((n) => n.type === "directory");
        setPapers(
          paperNodes.map((n) => ({
            slug: n.name,
            path: n.path,
            title: n.name,
            journal: "",
            status: "",
            lastExport: null,
            counts: { approved: 0, drafted: 0, outline: 0, total: 0 },
          })),
        );
      }

      if (selectedSlug && paperPath) {
        await loadSectionOrder(paperPath);
        try {
          const data = await fetchPaperDetail(selectedSlug);
          setDetail(data.paper);
        } catch {
          setDetail(null);
        }
      } else {
        setDetail(null);
        setSectionOrder([]);
        setChildOrders({});
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadSectionOrder, onError, paperPath, selectedSlug, tree]);

  useEffect(() => {
    void reload();
  }, [reload, currentPath, refreshVersion]);

  useEffect(() => {
    if (loading || selectedSlug || papers.length === 0) return;
    if (currentPath === "papers" || currentPath === "") {
      onNavigate(`papers/${papers[0].slug}`);
    }
  }, [currentPath, loading, onNavigate, papers, selectedSlug]);

  const sections = useMemo((): SectionRow[] => {
    if (!paperPath) return [];
    const fromTree = sectionsForPaper(tree, paperPath, sectionOrder);
    if (!detail?.sections.length) return fromTree;
    const byPath = new Map(detail.sections.map((s) => [s.path, s]));
    return fromTree.map((s) => ({
      ...s,
      title: byPath.get(s.path)?.title ?? s.title,
      counts: byPath.get(s.path)?.counts,
    }));
  }, [detail, paperPath, sectionOrder, tree]);

  const foldersNeedingChildOrder = useMemo(() => {
    if (!paperPath || !currentPath.startsWith(paperPath)) return [];
    const paths = new Set<string>();
    for (const section of sections) {
      if (currentPath === section.path || currentPath.startsWith(`${section.path}/`)) {
        paths.add(section.path);
        for (const child of orderedChildFolders(tree, section.path, childOrders[section.path] ?? [])) {
          if (currentPath === child.path || currentPath.startsWith(`${child.path}/`)) {
            paths.add(child.path);
          }
        }
      }
    }
    return [...paths];
  }, [childOrders, currentPath, paperPath, sections, tree]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const folderPath of foldersNeedingChildOrder) {
        if (childOrders[folderPath]) continue;
        const order = await loadChildOrder(folderPath);
        if (cancelled) return;
        setChildOrders((prev) =>
          prev[folderPath] ? prev : { ...prev, [folderPath]: order },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childOrders, foldersNeedingChildOrder, loadChildOrder]);

  const handlePaperChange = (slug: string) => {
    if (!slug) {
      onNavigate("papers");
      return;
    }
    onNavigate(`papers/${slug}`);
  };

  const handleSectionReorder = async (order: string[]) => {
    if (!paperPath) return;
    setReordering(true);
    try {
      await reorderChildren(paperPath, order);
      setSectionOrder(order);
      onModelChanged?.();
      await loadSectionOrder(paperPath);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setReordering(false);
    }
  };

  const handleChildReorder = async (parentPath: string, order: string[]) => {
    setReordering(true);
    try {
      await reorderChildren(parentPath, order);
      setChildOrders((prev) => ({ ...prev, [parentPath]: order }));
      onModelChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className={cn("space-y-3", embedded ? "p-3" : "border-b border-border px-4 py-3")}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="paper-select" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Paper
          </label>
          <Button
            type="button"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setShowNewPaper(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New
          </Button>
        </div>

        <PaperSelect
          papers={papers}
          selectedSlug={selectedSlug}
          loading={loading}
          onChange={handlePaperChange}
        />

        {detail ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {detail.journal ? `${detail.journal} · ` : null}
            {detail.status}
            {" · "}
            <CountsLine counts={detail.counts} />
          </p>
        ) : null}
      </div>

      {selectedSlug && paperPath ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sections
            </p>
            {sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sections in this paper.</p>
            ) : (
              <SectionOrderList
                sections={sections}
                currentPath={currentPath}
                tree={tree}
                childOrders={childOrders}
                reordering={reordering}
                onNavigate={onNavigate}
                onReorder={handleSectionReorder}
                onChildReorder={handleChildReorder}
              />
            )}
            {sections.length > 0 ? (
              <p className="text-[10px] text-muted-foreground">Drag to reorder</p>
            ) : null}
          </div>
        </div>
      ) : papers.length === 0 && !loading ? (
        <p className="text-xs text-muted-foreground">Create a paper to get started.</p>
      ) : null}

      {showNewPaper ? (
        <NewPaperModal
          onClose={() => setShowNewPaper(false)}
          onCreated={(path) => {
            setShowNewPaper(false);
            onPaperCreated(path);
          }}
          onError={onError}
        />
      ) : null}
    </div>
  );
}
