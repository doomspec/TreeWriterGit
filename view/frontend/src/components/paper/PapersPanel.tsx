import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical } from "lucide-react";

import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { PaperInfoLine } from "@/components/nav/PaperInfoLine";
import { PaperSelectorBar } from "@/components/nav/PaperSelectorBar";
import { TreeRowActions } from "@/components/nav/TreeRowActions";
import { UnapprovedIndicator } from "@/components/nav/UnapprovedIndicator";
import { cn } from "@/lib/utils";
import { useDraftPendingPaths } from "@/lib/draftPendingStore";
import {
  sectionNeedsHighlight,
  unapprovedSectionRowClass,
  unapprovedSectionTitle,
} from "@/lib/unapprovedHighlight";
import { navigateAfterArchive, useArchiveNodeDialog } from "@/lib/useArchiveNodeDialog";
import {
  indexPathFor,
  orderedChildFolders,
  parseIndexFrontmatter,
  sectionsForPaper,
  type ModelNode,
  type PaperSectionItem,
} from "@/lib/modelTree";
import {
  fetchPaperDetail,
  reorderChildren,
  type PaperDetail,
  type UnitStatusCounts,
} from "@/modelApi";
import { usePaperList } from "@/lib/usePaperList";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type SectionRow = PaperSectionItem & {
  counts?: UnitStatusCounts;
};

function FolderChildrenList({
  parent,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  depth = 0,
  onNavigate,
  onReorder,
  onDelete,
}: {
  parent: PaperSectionItem;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  depth?: number;
  onNavigate: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
}) {
  const expanded =
    currentPath === parent.path || currentPath.startsWith(`${parent.path}/`);
  if (!expanded) return null;

  const children = orderedChildFolders(tree, parent.path, childOrders[parent.path] ?? []);

  return (
    <div
      className={cn(
        "border-l border-border/60 pl-2",
        depth === 0 ? "ml-6" : "ml-3 border-border/40",
      )}
    >
      {children.length === 0 ? (
        <p className="px-2 py-1 text-[10px] text-muted-foreground">
          No subsections or units yet — open this folder and use the footer + buttons.
        </p>
      ) : (
        <ChildOrderList
          parentPath={parent.path}
          parentTitle={parent.title}
          items={children}
          currentPath={currentPath}
          tree={tree}
          childOrders={childOrders}
          containerCounts={containerCounts}
          reordering={reordering}
          depth={depth}
          onNavigate={onNavigate}
          onReorder={onReorder}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function ChildOrderList({
  parentPath,
  parentTitle,
  items,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  depth,
  onNavigate,
  onReorder,
  onDelete,
}: {
  parentPath: string;
  parentTitle: string;
  items: PaperSectionItem[];
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  depth: number;
  onNavigate: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDrop = async (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(toIndex, 0, moved);
    setDragIndex(null);
    setOverIndex(null);
    await onReorder(parentPath, next.map((c) => c.name));
  };

  return (
    <ul className="space-y-0.5" aria-label={`Children of ${parentTitle}`}>
      {items.map((child, index) => {
        const childActive = currentPath === child.path || currentPath.startsWith(`${child.path}/`);
        const textSize = depth === 0 ? "text-[11px]" : "text-[10px]";
        const rowPad = depth === 0 ? "py-1" : "py-0.5";
        const { highlight, pending, unapproved } = sectionNeedsHighlight(
          child.path,
          containerCounts[child.path],
        );

        return (
          <li key={child.path}>
            <div
              className={cn(
                "group flex items-stretch gap-0.5 rounded-md",
                unapprovedSectionRowClass({ highlight, pending, active: childActive, compact: true }),
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
                title="Drag to reorder"
                aria-hidden="true"
              >
                <GripVertical className="h-3 w-3" />
              </div>
              <button
                type="button"
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 text-left hover:bg-accent/40",
                  textSize,
                  rowPad,
                  childActive ? "bg-accent/50 font-medium text-foreground" : "text-muted-foreground",
                )}
                onClick={() => onNavigate(child.path)}
              >
                <span className={cn("flex min-w-0 items-center gap-1.5", highlight && "text-amber-950 dark:text-amber-50")}>
                  <UnapprovedIndicator pending={pending} unapproved={unapproved} />
                  <span className={cn("truncate", highlight && "text-amber-950 dark:text-amber-50")}>
                    {child.title}
                  </span>
                </span>
              </button>
              <TreeRowActions
                onDelete={() => onDelete(child.path, child.title)}
                deleteLabel={`Delete ${child.title}`}
              />
            </div>
            <FolderChildrenList
              parent={child}
              currentPath={currentPath}
              tree={tree}
              childOrders={childOrders}
              containerCounts={containerCounts}
              reordering={reordering}
              depth={depth + 1}
              onNavigate={onNavigate}
              onReorder={onReorder}
              onDelete={onDelete}
            />
          </li>
        );
      })}
    </ul>
  );
}

function SubsectionOrderList({
  parent,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  onNavigate,
  onReorder,
  onDelete,
}: {
  parent: SectionRow;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  onNavigate: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
}) {
  return (
    <FolderChildrenList
      parent={parent}
      currentPath={currentPath}
      tree={tree}
      childOrders={childOrders}
      containerCounts={containerCounts}
      reordering={reordering}
      onNavigate={onNavigate}
      onReorder={onReorder}
      onDelete={onDelete}
    />
  );
}

function SectionOrderList({
  sections,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  onNavigate,
  onReorder,
  onChildReorder,
  onDelete,
}: {
  sections: SectionRow[];
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  onNavigate: (path: string) => void;
  onReorder: (order: string[]) => Promise<void>;
  onChildReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
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

    return (
      <SubsectionOrderList
        parent={parent}
        currentPath={currentPath}
        tree={tree}
        childOrders={childOrders}
        containerCounts={containerCounts}
        reordering={reordering}
        onNavigate={onNavigate}
        onReorder={onChildReorder}
        onDelete={onDelete}
      />
    );
  };

  return (
    <ul className="space-y-1" aria-label="Paper sections">
      {sections.map((section, index) => {
        const active =
          currentPath === section.path || currentPath.startsWith(`${section.path}/`);
        const { highlight, pending, unapproved } = sectionNeedsHighlight(
          section.path,
          containerCounts[section.path] ?? section.counts,
        );
        return (
          <li key={section.path}>
            <div
              className={cn(
                "group flex items-stretch gap-1 rounded-md border border-border/60 bg-background transition-colors",
                unapprovedSectionRowClass({ highlight, pending, active }),
                active && !highlight ? "border-primary/40 bg-accent/50" : undefined,
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
                <span className="flex min-w-0 items-center gap-1.5">
                  <UnapprovedIndicator pending={pending} unapproved={unapproved} />
                  <span className={unapprovedSectionTitle("truncate font-medium", highlight)}>
                    {section.title}
                  </span>
                </span>
                {section.counts ? (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {section.counts.approved}/{section.counts.drafted}/{section.counts.outline}
                  </span>
                ) : null}
              </button>
              <TreeRowActions
                onDelete={() => onDelete(section.path, section.title)}
                deleteLabel={`Delete ${section.title}`}
                className="pr-1"
              />
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
  hidePaperHeader = false,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion?: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged?: () => void;
  onError: (message: string) => void;
  embedded?: boolean;
  hidePaperHeader?: boolean;
}) {
  const { papers, loading: papersLoading } = usePaperList(tree, refreshVersion ?? 0, onError);
  useDraftPendingPaths();
  const [detail, setDetail] = useState<PaperDetail | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [childOrders, setChildOrders] = useState<Record<string, string[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [reordering, setReordering] = useState(false);

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
    setDetailLoading(true);
    try {
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
      setDetailLoading(false);
    }
  }, [loadSectionOrder, onError, paperPath, selectedSlug]);

  const handleModelChanged = useCallback(() => {
    onModelChanged?.();
    void reload();
  }, [onModelChanged, reload]);

  const { requestArchive, dialogs: archiveDialogs } = useArchiveNodeDialog({
    onChanged: handleModelChanged,
    onError,
    onArchived: (path) => navigateAfterArchive(path, currentPath, onNavigate),
  });

  useEffect(() => {
    void reload();
  }, [reload, currentPath, refreshVersion]);

  useEffect(() => {
    if (papersLoading || detailLoading || selectedSlug || papers.length === 0) return;
    if (currentPath === "papers" || currentPath === "") {
      onNavigate(`papers/${papers[0].slug}`);
    }
  }, [currentPath, detailLoading, onNavigate, papers, papersLoading, selectedSlug]);

  const containerCounts = detail?.containerCounts ?? {};

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
    const paths: string[] = [];
    if (currentPath === paperPath) {
      paths.push(paperPath);
      return paths;
    }
    const relative = currentPath.slice(paperPath.length + 1);
    const parts = relative.split("/").filter(Boolean);
    let acc = paperPath;
    paths.push(acc);
    for (const part of parts) {
      acc = `${acc}/${part}`;
      paths.push(acc);
    }
    return paths;
  }, [currentPath, paperPath]);

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
    <div className={cn("space-y-3", embedded ? "p-3 pt-0" : "border-b border-border px-4 py-3")}>
      {!hidePaperHeader ? (
        <PaperSelectorBar
          tree={tree}
          currentPath={currentPath}
          refreshVersion={refreshVersion ?? 0}
          onNavigate={onNavigate}
          onPaperCreated={onPaperCreated}
          onError={onError}
        />
      ) : null}

      {detail && !hidePaperHeader ? (
        <PaperInfoLine
          slug={selectedSlug}
          refreshVersion={refreshVersion ?? 0}
          onError={onError}
        />
      ) : null}

      {selectedSlug && paperPath ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-left text-xs hover:bg-accent/40",
                currentPath === paperPath ? "border-primary/40 bg-accent/50 font-medium" : "bg-background",
              )}
              onClick={() => onNavigate(paperPath)}
            >
              <span className="truncate">{detail?.title ?? "Paper overview"}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">Outline · Draft</span>
            </button>
            {!hidePaperHeader ? (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sections
              </p>
            ) : null}
            {sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No sections yet — open the paper and use the footer + button.
              </p>
            ) : (
              <SectionOrderList
                sections={sections}
                currentPath={currentPath}
                tree={tree}
                childOrders={childOrders}
                containerCounts={containerCounts}
                reordering={reordering}
                onNavigate={onNavigate}
                onReorder={handleSectionReorder}
                onChildReorder={handleChildReorder}
                onDelete={requestArchive}
              />
            )}
            {sections.length > 0 ? (
              <p className="text-[10px] text-muted-foreground">
                Drag to reorder · hover to remove ·{" "}
                <span className="text-amber-700 dark:text-amber-300">amber = unapproved text</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : papers.length === 0 && !papersLoading ? (
        <p className="text-xs text-muted-foreground">Create a paper to get started.</p>
      ) : null}

      {archiveDialogs}
    </div>
  );
}
