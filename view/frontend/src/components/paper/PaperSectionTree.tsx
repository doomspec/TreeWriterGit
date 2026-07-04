import { useState } from "react";
import { GripVertical } from "lucide-react";

import { SectionTreeRowMeta, resolveSectionTreeCreateParent } from "@/components/paper/SectionTreeRowMeta";
import { UnapprovedIndicator } from "@/components/nav/UnapprovedIndicator";
import { cn } from "@/lib/utils";
import {
  sectionNeedsHighlight,
  unapprovedSectionRowClass,
  unapprovedSectionTitle,
} from "@/lib/unapprovedHighlight";
import { groupSectionTreeRows } from "@/lib/sectionTreeGrouping";
import type { NodeKind, UnitStatusCounts } from "@/modelApi";
import {
  findNode,
  isLeafEditorFolder,
  orderedChildFolders,
  type ModelNode,
  type PaperSectionItem,
} from "@/lib/modelTree";

export type SectionRow = PaperSectionItem & {
  counts?: UnitStatusCounts;
  draftWordCount?: number;
};

function sectionTreeDragHandleClass(compact = false): string {
  return cn(
    "flex h-5 shrink-0 cursor-grab items-center justify-center self-center rounded-l-md text-muted-foreground transition-colors",
    "hover:bg-muted/80 hover:text-foreground active:cursor-grabbing",
    compact ? "w-4" : "w-4",
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
    "section-tree-row__nav flex min-h-0 items-start gap-1 rounded-md px-1 py-0 text-left leading-tight transition-colors",
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

function nestedChildrenIndentClass(depth: number): string {
  return cn(
    "border-l border-border/60 pl-1.5",
    depth === 0 ? "ml-5" : "ml-2.5 border-border/40",
  );
}

function FolderChildrenList({
  parent,
  paperPath,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  containerWordCounts,
  reordering,
  depth = 0,
  isBranchExpanded,
  onTreeItemClick,
  onReorder,
  onDelete,
  onRename,
  onCreate,
  onConvertToSubsection,
  onDuplicate,
}: {
  parent: PaperSectionItem;
  paperPath: string;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  containerWordCounts: Record<string, number>;
  reordering: boolean;
  depth?: number;
  isBranchExpanded: (folderPath: string) => boolean;
  onTreeItemClick: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
  onRename: (path: string, label: string) => void;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onConvertToSubsection?: (path: string) => void;
  onDuplicate?: (path: string) => void;
}) {
  if (!isBranchExpanded(parent.path)) return null;

  const parentNode = findNode(tree, parent.path);
  if (isLeafEditorFolder(parentNode)) return null;

  const children = orderedChildFolders(tree, parent.path, childOrders[parent.path] ?? []);

  if (children.length === 0 && depth !== 0) return null;

  return (
    <div className={nestedChildrenIndentClass(depth)}>
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
          containerWordCounts={containerWordCounts}
          reordering={reordering}
          depth={depth}
          isBranchExpanded={isBranchExpanded}
          onTreeItemClick={onTreeItemClick}
          onReorder={onReorder}
          onDelete={onDelete}
          onRename={onRename}
          onCreate={onCreate}
          onConvertToSubsection={onConvertToSubsection}
          onDuplicate={onDuplicate}
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
  containerWordCounts,
  reordering,
  depth,
  isBranchExpanded,
  onTreeItemClick,
  onReorder,
  onDelete,
  onRename,
  onCreate,
  onConvertToSubsection,
  onDuplicate,
}: {
  parentPath: string;
  parentTitle: string;
  items: PaperSectionItem[];
  paperPath: string;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  containerWordCounts: Record<string, number>;
  reordering: boolean;
  depth: number;
  isBranchExpanded: (folderPath: string) => boolean;
  onTreeItemClick: (path: string) => void;
  onReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
  onRename: (path: string, label: string) => void;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onConvertToSubsection?: (path: string) => void;
  onDuplicate?: (path: string) => void;
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

  const rows = groupSectionTreeRows(items, tree);

  const renderItem = (child: PaperSectionItem, index: number, dragEnabled: boolean) => {
    const childActive = currentPath === child.path || currentPath.startsWith(`${child.path}/`);
    const textSize = "text-[10px]";
    const rowPad = "py-0";
    const { highlight, pending, unapproved } = sectionNeedsHighlight(
      child.path,
      containerCounts[child.path],
    );

    return (
      <>
        <div
          className={cn(
            "section-tree-row group flex items-center gap-0.5 rounded-md",
            unapprovedSectionRowClass({ highlight, pending, active: childActive, compact: true }),
            dragEnabled && dragIndex === index ? "opacity-50" : undefined,
            dragEnabled &&
              overIndex === index &&
              dragIndex !== null &&
              dragIndex !== index
              ? "ring-1 ring-primary/40"
              : undefined,
            reordering ? "pointer-events-none opacity-60" : undefined,
          )}
        >
          {dragEnabled ? (
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
              <GripVertical className="h-2.5 w-2.5" />
            </div>
          ) : null}
          <button
            type="button"
            className={sectionTreeNavButtonClass({
              active: childActive,
              highlight,
              textSize,
              rowPad,
            })}
            onClick={() => onTreeItemClick(child.path)}
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
            rowPath={child.path}
            counts={containerCounts[child.path]}
            wordCount={containerWordCounts[child.path]}
            disabled={reordering}
            onCreate={onCreate}
            onRename={() => onRename(child.path, child.title)}
            onDelete={() => onDelete(child.path, child.title)}
            onConvertToSubsection={
              onConvertToSubsection ? () => onConvertToSubsection(child.path) : undefined
            }
            onDuplicate={onDuplicate ? () => onDuplicate(child.path) : undefined}
          />
        </div>
        <FolderChildrenList
          parent={child}
          paperPath={paperPath}
          currentPath={currentPath}
          tree={tree}
          childOrders={childOrders}
          containerCounts={containerCounts}
          containerWordCounts={containerWordCounts}
          reordering={reordering}
          depth={depth + 1}
          isBranchExpanded={isBranchExpanded}
          onTreeItemClick={onTreeItemClick}
          onReorder={onReorder}
          onDelete={onDelete}
          onRename={onRename}
          onCreate={onCreate}
          onConvertToSubsection={onConvertToSubsection}
          onDuplicate={onDuplicate}
        />
      </>
    );
  };

  return (
    <ul className="space-y-0.5" aria-label={`Children of ${parentTitle}`}>
      {rows.map((row) => {
        if (row.type === "units-under-subsection") {
          return (
            <li key={`${row.subsection.path}__grouped-units`}>
              <div className={nestedChildrenIndentClass(depth + 1)}>
                <ChildOrderList
                  parentPath={row.subsection.path}
                  parentTitle={row.subsection.title}
                  items={row.units}
                  paperPath={paperPath}
                  currentPath={currentPath}
                  tree={tree}
                  childOrders={childOrders}
                  containerCounts={containerCounts}
                  containerWordCounts={containerWordCounts}
                  reordering={reordering}
                  depth={depth + 1}
                  isBranchExpanded={isBranchExpanded}
                  onTreeItemClick={onTreeItemClick}
                  onReorder={onReorder}
                  onDelete={onDelete}
                  onRename={onRename}
                  onCreate={onCreate}
                  onConvertToSubsection={onConvertToSubsection}
                  onDuplicate={onDuplicate}
                />
              </div>
            </li>
          );
        }

        const index = items.indexOf(row.item);
        return (
          <li key={row.item.path}>
            {renderItem(row.item, index, true)}
          </li>
        );
      })}
    </ul>
  );
}

export function SectionOrderList({
  sections,
  paperPath,
  currentPath,
  tree,
  childOrders,
  containerCounts,
  containerWordCounts,
  reordering,
  isBranchExpanded,
  onTreeItemClick,
  onReorder,
  onChildReorder,
  onDelete,
  onRename,
  onCreate,
  onConvertToSubsection,
  onDuplicate,
}: {
  sections: SectionRow[];
  paperPath: string;
  currentPath: string;
  tree: ModelNode[];
  childOrders: Record<string, string[]>;
  containerCounts: Record<string, UnitStatusCounts>;
  containerWordCounts: Record<string, number>;
  reordering: boolean;
  isBranchExpanded: (folderPath: string) => boolean;
  onTreeItemClick: (path: string) => void;
  onReorder: (order: string[]) => Promise<void>;
  onChildReorder: (parentPath: string, order: string[]) => Promise<void>;
  onDelete: (path: string, label: string) => void;
  onRename: (path: string, label: string) => void;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onConvertToSubsection?: (path: string) => void;
  onDuplicate?: (path: string) => void;
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
    if (!isBranchExpanded(parent.path)) return null;

    return (
      <FolderChildrenList
        parent={parent}
        paperPath={paperPath}
        currentPath={currentPath}
        tree={tree}
        childOrders={childOrders}
        containerCounts={containerCounts}
        containerWordCounts={containerWordCounts}
        reordering={reordering}
        isBranchExpanded={isBranchExpanded}
        onTreeItemClick={onTreeItemClick}
        onReorder={onChildReorder}
        onDelete={onDelete}
        onRename={onRename}
        onCreate={onCreate}
        onConvertToSubsection={onConvertToSubsection}
        onDuplicate={onDuplicate}
      />
    );
  };

  return (
    <ul className="space-y-0.5" aria-label="Paper sections">
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
                "section-tree-row group flex items-center gap-0.5 rounded-md border border-border/60 bg-background transition-colors",
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
                <GripVertical className="h-2.5 w-2.5" />
              </div>
              <button
                type="button"
                className={sectionTreeNavButtonClass({
                  active,
                  highlight,
                  textSize: "text-[11px]",
                  rowPad: "py-0",
                })}
                onClick={() => onTreeItemClick(section.path)}
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
                rowPath={section.path}
                counts={section.counts}
                wordCount={section.draftWordCount ?? containerWordCounts[section.path]}
                disabled={reordering}
                onCreate={onCreate}
                onRename={() => onRename(section.path, section.title)}
                onDelete={() => onDelete(section.path, section.title)}
                onDuplicate={onDuplicate ? () => onDuplicate(section.path) : undefined}
              />
            </div>
            {renderChildren(section)}
          </li>
        );
      })}
    </ul>
  );
}

export function sectionTreeNavButtonClassName(options: {
  active: boolean;
  highlight: boolean;
  textSize: string;
  rowPad?: string;
}): string {
  return sectionTreeNavButtonClass(options);
}
