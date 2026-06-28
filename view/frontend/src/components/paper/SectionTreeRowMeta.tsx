import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Copy, Pencil, Trash2, FolderTree } from "lucide-react";

import {
  TREE_ROW_CREATE_ICONS,
  TreeRowActions,
  type TreeRowCreateOption,
} from "@/components/nav/TreeRowActions";
import { Button } from "@/components/ui/button";
import { UNIT_STATUS_COUNTS_HINT } from "@/lib/unapprovedHighlight";
import { computeFloatingMenuTop } from "@/lib/floatingMenuPosition";
import { canAddManuscriptChildren, findNode, isUnitFolder, type ModelNode } from "@/lib/modelTree";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import type { NodeKind } from "@/modelApi";
import type { UnitStatusCounts } from "@/modelApi";

function createMenuOptions(
  createParentPath: string,
  paperPath: string,
  tree: ModelNode[],
): TreeRowCreateOption[] | null {
  const node = findNode(tree, createParentPath);
  if (!canAddManuscriptChildren(node, createParentPath, paperPath)) return null;
  const atPaperRoot = createParentPath === paperPath;
  return atPaperRoot
    ? [{ kind: "section", label: "Add section", Icon: TREE_ROW_CREATE_ICONS.section }]
    : [
        { kind: "unit", label: "Add unit", Icon: TREE_ROW_CREATE_ICONS.unit },
        { kind: "subsection", label: "Add subsection", Icon: TREE_ROW_CREATE_ICONS.subsection },
      ];
}

/** Where new manuscript nodes should be created for a tree row. */
export function resolveSectionTreeCreateParent(
  rowPath: string,
  listParentPath: string,
  tree: ModelNode[],
  paperPath: string,
): string {
  const rowNode = findNode(tree, rowPath);
  if (canAddManuscriptChildren(rowNode, rowPath, paperPath)) return rowPath;
  return listParentPath;
}

function SectionRowOverflowMenu({
  createParentPath,
  paperPath,
  tree,
  title,
  disabled,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onConvertToSubsection,
  showRename = true,
  showDelete = true,
}: {
  createParentPath: string;
  paperPath: string;
  tree: ModelNode[];
  title: string;
  disabled?: boolean;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onConvertToSubsection?: () => void;
  showRename?: boolean;
  showDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const createOptions = createMenuOptions(createParentPath, paperPath, tree);
  const hasRename = showRename && onRename;
  const hasDelete = showDelete && onDelete;
  const hasDuplicate = Boolean(onDuplicate);
  const hasConvert = Boolean(onConvertToSubsection);
  const hasActions = createOptions?.length || hasRename || hasDelete || hasDuplicate || hasConvert;

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
      const menu = menuRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = menu?.offsetWidth ?? 160;
      const menuHeight = menu?.offsetHeight ?? 140;
      setMenuPosition({
        top: computeFloatingMenuTop(rect, menuHeight),
        left: Math.max(8, rect.right - menuWidth),
      });
    };

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  if (!hasActions) return null;

  const chooseCreate = (kind: NodeKind) => {
    setOpen(false);
    onCreate(createParentPath, kind);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        title={`Actions for ${title}`}
        aria-label={`Actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              className="fixed z-overlay min-w-[10rem] rounded-md border border-border bg-card py-1 text-card-foreground shadow-lg"
            >
              {createOptions?.map(({ kind, label, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    chooseCreate(kind);
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {label}
                </button>
              )) ?? null}
              {createOptions?.length &&
              (hasRename || hasDelete || hasDuplicate || hasConvert) ? (
                <div className="my-1 border-t border-border" aria-hidden="true" />
              ) : null}
              {hasDuplicate ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onDuplicate?.();
                  }}
                >
                  <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  Duplicate
                </button>
              ) : null}
              {hasConvert ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onConvertToSubsection?.();
                  }}
                >
                  <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  Convert to subsection
                </button>
              ) : null}
              {hasConvert && (hasRename || hasDelete) ? (
                <div className="my-1 border-t border-border" aria-hidden="true" />
              ) : null}
              {hasRename ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onRename();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  Rename
                </button>
              ) : null}
              {hasDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Remove
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function SectionTreeRowMeta({
  createParentPath,
  paperPath,
  tree,
  title,
  rowPath,
  counts,
  disabled,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onConvertToSubsection,
  showRename = true,
  showDelete = true,
}: {
  createParentPath: string;
  paperPath: string;
  tree: ModelNode[];
  title: string;
  rowPath: string;
  counts?: UnitStatusCounts;
  disabled?: boolean;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onConvertToSubsection?: () => void;
  showRename?: boolean;
  showDelete?: boolean;
}) {
  const { assignedCountsByFolder } = useWorkspaceNavigationContext();
  const assignedUnresolvedCount = assignedCountsByFolder.get(rowPath) ?? 0;
  const createOptions = createMenuOptions(createParentPath, paperPath, tree);
  const canConvert = isUnitFolder(findNode(tree, rowPath)) && onConvertToSubsection;

  return (
    <>
      <div className="section-tree-row__meta section-tree-row__meta-inline flex shrink-0 items-center gap-1 pr-0.5">
        {counts ? (
          <span
            className="section-tree-row__counts font-mono text-[10px] text-muted-foreground"
            title={UNIT_STATUS_COUNTS_HINT}
          >
            {counts.approved}/{counts.drafted}/{counts.outline}
          </span>
        ) : null}
        {assignedUnresolvedCount && assignedUnresolvedCount > 0 ? (
          <span
            className="rounded bg-primary/10 px-1 font-mono text-[9px] text-primary"
            title={`${assignedUnresolvedCount} assigned comment${assignedUnresolvedCount === 1 ? "" : "s"}`}
          >
            {assignedUnresolvedCount}↗
          </span>
        ) : null}
        {(createOptions && createOptions.length > 0) ||
        (showRename && onRename) ||
        (showDelete && onDelete) ||
        onDuplicate ? (
          <TreeRowActions
            createOptions={createOptions ?? undefined}
            onCreate={createOptions ? (kind) => onCreate(createParentPath, kind) : undefined}
            onRename={showRename ? onRename : undefined}
            renameLabel={`Rename ${title}`}
            onDelete={showDelete ? onDelete : undefined}
            deleteLabel={`Delete ${title}`}
            onDuplicate={onDuplicate}
            duplicateLabel={`Duplicate ${title}`}
            disabled={disabled}
          />
        ) : null}
      </div>
      <div className="section-tree-row__meta section-tree-row__meta-menu shrink-0 pr-0.5">
        <SectionRowOverflowMenu
          createParentPath={createParentPath}
          paperPath={paperPath}
          tree={tree}
          title={title}
          disabled={disabled}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onConvertToSubsection={canConvert ? () => onConvertToSubsection?.() : undefined}
          showRename={showRename}
          showDelete={showDelete}
        />
      </div>
    </>
  );
}
