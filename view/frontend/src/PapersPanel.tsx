import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, GripVertical, Inbox, Plus, Upload } from "lucide-react";

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
  exportPaper,
  importOverleafFeedback,
  pushToOverleaf,
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
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
  embedded = false,
}: {
  tree: ModelNode[];
  currentPath: string;
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
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [pushingOverleaf, setPushingOverleaf] = useState(false);
  const [importingOverleaf, setImportingOverleaf] = useState(false);

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
  }, [reload, currentPath]);

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

  const handleExport = async (format: "latex" | "pdf") => {
    if (!selectedSlug) return;
    setExporting(true);
    setExportNotice(null);
    try {
      const result = await exportPaper({
        paperSlug: selectedSlug,
        format,
        includeDrafts: true,
      });
      window.open(`${apiBaseUrl}${result.downloadUrl}`, "_blank");
      const notices: string[] = [];
      if (result.notice) notices.push(result.notice);
      if (result.missingCitations?.length) {
        notices.push(`Missing citations: ${result.missingCitations.join(", ")}`);
      }
      setExportNotice(notices.length ? notices.join(" · ") : null);
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleOverleafPush = async () => {
    if (!selectedSlug) return;
    setPushingOverleaf(true);
    setExportNotice(null);
    try {
      const result = await pushToOverleaf({ paperSlug: selectedSlug, includeDrafts: true });
      const notices = [result.message];
      if (result.missingCitations?.length) {
        notices.push(`Missing citations: ${result.missingCitations.join(", ")}`);
      }
      setExportNotice(notices.join(" · "));
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setPushingOverleaf(false);
    }
  };

  const handleOverleafImport = async () => {
    if (!selectedSlug) return;
    setImportingOverleaf(true);
    setExportNotice(null);
    try {
      const result = await importOverleafFeedback(selectedSlug);
      setExportNotice(
        result.imported > 0
          ? `Imported ${result.imported} Overleaf feedback note${result.imported === 1 ? "" : "s"}`
          : "No \\todo comments found in main.tex",
      );
      if (result.imported > 0) onModelChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingOverleaf(false);
    }
  };

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
    <div className={cn("space-y-2", embedded ? "p-3" : "border-b border-border px-4 py-3")}>
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

      <select
        id="paper-select"
        value={selectedSlug ?? ""}
        disabled={loading && papers.length === 0}
        className={cn(
          "h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none ring-primary focus:ring-1",
          loading ? "opacity-60" : undefined,
        )}
        onChange={(e) => handlePaperChange(e.target.value)}
      >
        <option value="">{papers.length === 0 ? "No papers yet" : "Select a paper…"}</option>
        {papers.map((paper) => (
          <option key={paper.slug} value={paper.slug}>
            {paper.title}
            {paper.journal ? ` · ${paper.journal}` : ""}
          </option>
        ))}
      </select>

      {selectedSlug && paperPath ? (
        <div className="space-y-2 pt-1">
          {detail ? (
            <div className="rounded-md border border-border/80 bg-background px-2.5 py-2 text-xs">
              <div className="text-muted-foreground">
                {detail.journal} · {detail.status}
              </div>
              <CountsLine counts={detail.counts} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={exporting || pushingOverleaf || importingOverleaf}
              onClick={() => void handleExport("latex")}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export .tex
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={exporting || pushingOverleaf || importingOverleaf}
              title="Requires a LaTeX engine (brew install tectonic). Falls back to .tex if missing."
              onClick={() => void handleExport("pdf")}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={exporting || pushingOverleaf || importingOverleaf}
              title="Requires overleaf_repo_path in paper INDEX.md"
              onClick={() => void handleOverleafPush()}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Push Overleaf
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={exporting || pushingOverleaf || importingOverleaf}
              title="Parse \\todo comments from Overleaf main.tex into notes/feedback/"
              onClick={() => void handleOverleafImport()}
            >
              <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
              Import feedback
            </Button>
          </div>
          {exportNotice ? (
            <p className="text-xs text-muted-foreground">{exportNotice}</p>
          ) : null}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sections · drag to reorder
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
