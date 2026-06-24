import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { PaperInfoLine } from "@/components/nav/PaperInfoLine";
import { PaperSelectorBar } from "@/components/nav/PaperSelectorBar";
import { SectionTreeRowMeta, resolveSectionTreeCreateParent } from "@/components/paper/SectionTreeRowMeta";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { UnapprovedIndicator } from "@/components/nav/UnapprovedIndicator";
import { cn } from "@/lib/utils";
import { useDraftPendingPaths, replaceServerDraftPendingPaths } from "@/lib/draftPendingStore";
import {
  sectionNeedsHighlight,
  unapprovedSectionRowClass,
  unapprovedSectionTitle,
} from "@/lib/unapprovedHighlight";
import { loadIndexChildOrder } from "@/lib/indexChildOrder";
import { navigateAfterArchive, useArchiveNodeDialog } from "@/lib/useArchiveNodeDialog";
import {
  findNode,
  isLeafEditorFolder,
  orderedChildFolders,
  sectionsForPaper,
  type ModelNode,
  type PaperSectionItem,
} from "@/lib/modelTree";
import {
  createNode,
  fetchPaperDetail,
  moveNode,
  reorderChildren,
  type NodeKind,
  type PaperDetail,
  type UnitStatusCounts,
} from "@/modelApi";
import { usePaperList } from "@/lib/usePaperList";

type SectionRow = PaperSectionItem & {
  counts?: UnitStatusCounts;
};

type CreatePrompt = {
  parentPath: string;
  kind: NodeKind;
};

type RenameTarget = {
  path: string;
  label: string;
};

function sectionTreeDragHandleClass(compact = false): string {
  return cn(
    "flex shrink-0 cursor-grab items-center justify-center rounded-l-md text-muted-foreground transition-colors",
    "hover:bg-muted/80 hover:text-foreground active:cursor-grabbing",
    compact ? "w-5" : "w-7",
  );
}

function sectionTreeNavButtonClass(options: {
  active: boolean;
  highlight: boolean;
  textSize: string;
  rowPad?: string;
}): string {
  const { active, highlight, textSize, rowPad } = options;
  return cn(
    "section-tree-row__nav flex items-center gap-1.5 rounded-md px-2 text-left transition-colors",
    textSize,
    rowPad,
    highlight
      ? active
        ? "bg-amber-500/20 font-medium text-amber-950 hover:bg-amber-500/30 dark:text-amber-50"
        : "text-amber-900 hover:bg-amber-500/15 hover:text-amber-950 dark:text-amber-100 dark:hover:text-amber-50"
      : active
        ? "bg-accent/50 font-medium text-foreground hover:bg-primary/15 hover:text-foreground"
        : "text-muted-foreground hover:bg-accent/45 hover:text-foreground",
  );
}

function FolderChildrenList({
  parent,
  paperPath,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  depth = 0,
  onNavigate,
  onReorder,
  onDelete,
  onRename,
  onCreate,
}: {
  parent: PaperSectionItem;
  paperPath: string;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  depth?: number;
  onNavigate: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
  onRename: (path: string, label: string) => void;
  onCreate: (parentPath: string, kind: NodeKind) => void;
}) {
  const expanded =
    currentPath === parent.path || currentPath.startsWith(`${parent.path}/`);
  if (!expanded) return null;

  const parentNode = findNode(tree, parent.path);
  if (isLeafEditorFolder(parentNode)) return null;

  const children = orderedChildFolders(tree, parent.path, childOrders[parent.path] ?? []);

  if (children.length === 0 && depth !== 0) return null;

  return (
    <div
      className={cn(
        "border-l border-border/60 pl-2",
        depth === 0 ? "ml-6" : "ml-3 border-border/40",
      )}
    >
      {children.length === 0 ? (
        <p className="px-2 py-1 text-[10px] text-muted-foreground">
          No subsections or units yet — use + on a folder above to add a subsection or unit.
        </p>
      ) : (
        <ChildOrderList
          parentPath={parent.path}
          parentTitle={parent.title}
          items={children}
          paperPath={paperPath}
          currentPath={currentPath}
          tree={tree}
          childOrders={childOrders}
          containerCounts={containerCounts}
          reordering={reordering}
          depth={depth}
          onNavigate={onNavigate}
          onReorder={onReorder}
          onDelete={onDelete}
          onRename={onRename}
          onCreate={onCreate}
        />
      )}
    </div>
  );
}

function ChildOrderList({
  parentPath,
  parentTitle,
  items,
  paperPath,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  depth,
  onNavigate,
  onReorder,
  onDelete,
  onRename,
  onCreate,
}: {
  parentPath: string;
  parentTitle: string;
  items: PaperSectionItem[];
  paperPath: string;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  depth: number;
  onNavigate: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
  onRename: (path: string, label: string) => void;
  onCreate: (parentPath: string, kind: NodeKind) => void;
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
                "section-tree-row group flex items-stretch gap-0.5 rounded-md",
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
                className={sectionTreeDragHandleClass(true)}
                title="Drag to reorder"
                aria-hidden="true"
              >
                <GripVertical className="h-3 w-3" />
              </div>
              <button
                type="button"
                className={sectionTreeNavButtonClass({
                  active: childActive,
                  highlight,
                  textSize,
                  rowPad,
                })}
                onClick={() => onNavigate(child.path)}
              >
                <UnapprovedIndicator pending={pending} unapproved={unapproved} />
                <span
                  className={cn(
                    "section-tree-row__title",
                    highlight && "text-amber-950 dark:text-amber-50",
                  )}
                >
                  {child.title}
                </span>
              </button>
              <SectionTreeRowMeta
                createParentPath={resolveSectionTreeCreateParent(
                  child.path,
                  parentPath,
                  tree,
                  paperPath,
                )}
                paperPath={paperPath}
                tree={tree}
                title={child.title}
                disabled={reordering}
                onCreate={onCreate}
                onRename={() => onRename(child.path, child.title)}
                onDelete={() => onDelete(child.path, child.title)}
              />
            </div>
            <FolderChildrenList
              parent={child}
              paperPath={paperPath}
              currentPath={currentPath}
              tree={tree}
              childOrders={childOrders}
              containerCounts={containerCounts}
              reordering={reordering}
              depth={depth + 1}
              onNavigate={onNavigate}
              onReorder={onReorder}
              onDelete={onDelete}
              onRename={onRename}
              onCreate={onCreate}
            />
          </li>
        );
      })}
    </ul>
  );
}

function SubsectionOrderList({
  parent,
  paperPath,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  onNavigate,
  onReorder,
  onDelete,
  onRename,
  onCreate,
}: {
  parent: SectionRow;
  paperPath: string;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  onNavigate: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
  onRename: (path: string, label: string) => void;
  onCreate: (parentPath: string, kind: NodeKind) => void;
}) {
  return (
    <FolderChildrenList
      parent={parent}
      paperPath={paperPath}
      currentPath={currentPath}
      tree={tree}
      childOrders={childOrders}
      containerCounts={containerCounts}
      reordering={reordering}
      onNavigate={onNavigate}
      onReorder={onReorder}
      onDelete={onDelete}
      onRename={onRename}
      onCreate={onCreate}
    />
  );
}

function SectionOrderList({
  sections,
  paperPath,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  reordering,
  onNavigate,
  onReorder,
  onChildReorder,
  onDelete,
  onRename,
  onCreate,
}: {
  sections: SectionRow[];
  paperPath: string;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  reordering: boolean;
  onNavigate: (path: string) => void;
  onReorder: (order: string[]) => Promise<void>;
  onChildReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
  onRename: (path: string, label: string) => void;
  onCreate: (parentPath: string, kind: NodeKind) => void;
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
        paperPath={paperPath}
        currentPath={currentPath}
        tree={tree}
        childOrders={childOrders}
        containerCounts={containerCounts}
        reordering={reordering}
        onNavigate={onNavigate}
        onReorder={onChildReorder}
        onDelete={onDelete}
        onRename={onRename}
        onCreate={onCreate}
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
                "section-tree-row group flex items-stretch gap-1 rounded-md border border-border/60 bg-background transition-colors",
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
                className={sectionTreeDragHandleClass()}
                title="Drag to reorder"
                aria-hidden="true"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <button
                type="button"
                className={sectionTreeNavButtonClass({
                  active,
                  highlight,
                  textSize: "text-xs",
                  rowPad: "py-1.5",
                })}
                onClick={() => onNavigate(section.path)}
              >
                <UnapprovedIndicator pending={pending} unapproved={unapproved} />
                <span className={unapprovedSectionTitle("section-tree-row__title font-medium", highlight)}>
                  {section.title}
                </span>
              </button>
              <SectionTreeRowMeta
                createParentPath={section.path}
                paperPath={paperPath}
                tree={tree}
                title={section.title}
                counts={section.counts}
                disabled={reordering}
                onCreate={onCreate}
                onRename={() => onRename(section.path, section.title)}
                onDelete={() => onDelete(section.path, section.title)}
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
  const [createPrompt, setCreatePrompt] = useState<CreatePrompt | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);

  const selectedSlug = useMemo(() => paperSlugFromPath(currentPath), [currentPath]);
  const paperPath = selectedSlug ? `papers/${selectedSlug}` : null;

  const requestCreate = useCallback((parentPath: string, kind: NodeKind) => {
    setCreatePrompt({ parentPath, kind });
  }, []);

  const requestRename = useCallback((path: string, label: string) => {
    setRenameTarget({ path, label });
  }, []);

  const loadChildOrder = useCallback(
    (path: string) => loadIndexChildOrder(path),
    [],
  );

  const loadSectionOrder = useCallback(
    async (path: string) => {
      const order = await loadChildOrder(path);
      setSectionOrder(order);
      return order;
    },
    [loadChildOrder],
  );

  const submitCreate = useCallback(
    async (name: string) => {
      if (!createPrompt) return;
      const { parentPath, kind } = createPrompt;
      setCreatePrompt(null);
      try {
        const created = await createNode(parentPath, name, kind);
        onModelChanged?.();
        onNavigate(created.path);
        const order = await loadChildOrder(parentPath);
        setChildOrders((prev) => ({ ...prev, [parentPath]: order }));
        if (paperPath && parentPath === paperPath) {
          await loadSectionOrder(paperPath);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [createPrompt, loadChildOrder, loadSectionOrder, onError, onModelChanged, onNavigate, paperPath],
  );

  const reload = useCallback(async () => {
    setDetailLoading(true);
    try {
      if (selectedSlug && paperPath) {
        await loadSectionOrder(paperPath);
        try {
          const data = await fetchPaperDetail(selectedSlug);
          setDetail(data.paper);
          replaceServerDraftPendingPaths(data.paper.pendingApprovalPaths ?? []);
        } catch {
          setDetail(null);
          replaceServerDraftPendingPaths([]);
        }
      } else {
        setDetail(null);
        setSectionOrder([]);
        setChildOrders({});
        replaceServerDraftPendingPaths([]);
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

  const submitRename = useCallback(
    async (nextName: string) => {
      if (!renameTarget) return;
      const { path } = renameTarget;
      setRenameTarget(null);
      const current = path.split("/").at(-1) ?? "";
      if (nextName === current) return;
      const parent = path.split("/").slice(0, -1).join("/");
      const to = `${parent}/${nextName}`;
      try {
        await moveNode(path, to);
        if (currentPath === path || currentPath.startsWith(`${path}/`)) {
          onNavigate(currentPath.replace(path, to));
        }
        handleModelChanged();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentPath, handleModelChanged, onError, onNavigate, renameTarget],
  );

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

  const paperHighlight = paperPath
    ? sectionNeedsHighlight(paperPath, containerCounts[paperPath] ?? detail?.counts)
    : { highlight: false, pending: false, unapproved: false };

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
        if (folderPath in childOrders) continue;
        const order = await loadChildOrder(folderPath);
        if (cancelled) return;
        setChildOrders((prev) =>
          folderPath in prev ? prev : { ...prev, [folderPath]: order },
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
          onModelChanged={onModelChanged}
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
            <div
              className={cn(
                "section-tree-row flex items-stretch gap-0.5 rounded-md border border-border/60 bg-background",
                unapprovedSectionRowClass({
                  highlight: paperHighlight.highlight,
                  pending: paperHighlight.pending,
                  active: currentPath === paperPath,
                }),
                currentPath === paperPath ? "border-primary/40 bg-accent/50" : undefined,
              )}
            >
              <button
                type="button"
                className={sectionTreeNavButtonClass({
                  active: currentPath === paperPath,
                  highlight: paperHighlight.highlight,
                  textSize: "text-xs",
                  rowPad: "py-1.5",
                })}
                onClick={() => onNavigate(paperPath)}
              >
                <UnapprovedIndicator
                  pending={paperHighlight.pending}
                  unapproved={paperHighlight.unapproved}
                />
                <span
                  className={unapprovedSectionTitle(
                    "section-tree-row__title font-medium",
                    paperHighlight.highlight,
                  )}
                >
                  {detail?.title ?? "Paper overview"}
                </span>
                <span className="section-tree-row__meta-label shrink-0 text-[10px] text-muted-foreground">
                  Outline · Draft
                </span>
              </button>
              <SectionTreeRowMeta
                createParentPath={paperPath}
                paperPath={paperPath}
                tree={tree}
                title={detail?.title ?? "Paper overview"}
                disabled={reordering}
                onCreate={requestCreate}
                showRename={false}
                showDelete={false}
              />
            </div>
            {!hidePaperHeader ? (
              <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sections
              </p>
            ) : null}
            {sections.length === 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  No sections yet — use + on the paper row above to add a section.
                </p>
              </div>
            ) : (
              <SectionOrderList
                sections={sections}
                paperPath={paperPath!}
                currentPath={currentPath}
                tree={tree}
                childOrders={childOrders}
                containerCounts={containerCounts}
                reordering={reordering}
                onNavigate={onNavigate}
                onReorder={handleSectionReorder}
                onChildReorder={handleChildReorder}
                onDelete={requestArchive}
                onRename={requestRename}
                onCreate={requestCreate}
              />
            )}
            {sections.length > 0 ? (
              <p className="text-[10px] text-muted-foreground">
                Drag to reorder · hover for + rename remove · ⋯ on narrow sidebar ·{" "}
                <span className="text-amber-700 dark:text-amber-300">amber = unapproved text</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : papers.length === 0 && !papersLoading ? (
        <p className="text-xs text-muted-foreground">Create a paper to get started.</p>
      ) : null}

      {archiveDialogs}

      <NamePromptDialog
        open={createPrompt !== null}
        title={createPrompt ? `New ${createPrompt.kind}` : "New node"}
        label="Folder-safe name (lowercase, hyphens ok)"
        confirmLabel="Create"
        onConfirm={(name) => void submitCreate(name)}
        onCancel={() => setCreatePrompt(null)}
      />
      <NamePromptDialog
        open={renameTarget !== null}
        title="Rename"
        label="Folder-safe name (lowercase, hyphens ok)"
        defaultValue={renameTarget?.path.split("/").at(-1) ?? ""}
        confirmLabel="Rename"
        onConfirm={(name) => void submitRename(name)}
        onCancel={() => setRenameTarget(null)}
      />
    </div>
  );
}
