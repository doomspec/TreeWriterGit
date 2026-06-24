import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FilePlus, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { TreeRowActions } from "@/components/nav/TreeRowActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UNIT_STATUS_COUNTS_HINT } from "@/lib/unapprovedHighlight";
import { canAddManuscriptChildren, findNode, type ModelNode } from "@/lib/modelTree";
import type { NodeKind } from "@/modelApi";
import type { UnitStatusCounts } from "@/modelApi";

type CreateMenuOption = {
  kind: NodeKind;
  label: string;
  Icon: typeof FolderPlus;
};

function createMenuOptions(
  parentPath: string,
  paperPath: string,
  tree: ModelNode[],
): CreateMenuOption[] | null {
  const node = findNode(tree, parentPath);
  if (!canAddManuscriptChildren(node, parentPath, paperPath)) return null;
  const atPaperRoot = parentPath === paperPath;
  return atPaperRoot
    ? [{ kind: "section", label: "Add section", Icon: FolderPlus }]
    : [
        { kind: "unit", label: "Add unit", Icon: FilePlus },
        { kind: "subsection", label: "Add subsection", Icon: FolderPlus },
      ];
}

function SectionCreateMenu({
  parentPath,
  paperPath,
  tree,
  disabled,
  onCreate,
}: {
  parentPath: string;
  paperPath: string;
  tree: ModelNode[];
  disabled?: boolean;
  onCreate: (parentPath: string, kind: NodeKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const options = createMenuOptions(parentPath, paperPath, tree);
  if (!options) return null;

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
        right: window.innerWidth - rect.right,
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

  const choose = (kind: NodeKind) => {
    setOpen(false);
    onCreate(parentPath, kind);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-400"
        title="Add to section"
        aria-label="Add to section"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (options.length === 1) {
            choose(options[0]!.kind);
            return;
          }
          setOpen((value) => !value);
        }}
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
      </Button>
      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: menuPosition.top, right: menuPosition.right }}
              className="fixed z-overlay min-w-[9.5rem] rounded-md border border-border bg-card py-1 text-card-foreground shadow-lg"
            >
              {options.map(({ kind, label, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 bg-card px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    choose(kind);
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SectionRowOverflowMenu({
  parentPath,
  paperPath,
  tree,
  title,
  disabled,
  onCreate,
  onRename,
  onDelete,
  showRename = true,
  showDelete = true,
}: {
  parentPath: string;
  paperPath: string;
  tree: ModelNode[];
  title: string;
  disabled?: boolean;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onRename?: () => void;
  onDelete?: () => void;
  showRename?: boolean;
  showDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const createOptions = createMenuOptions(parentPath, paperPath, tree);
  const hasRename = showRename && onRename;
  const hasDelete = showDelete && onDelete;
  const hasActions = createOptions?.length || hasRename || hasDelete;

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
        left: Math.max(8, rect.right - 160),
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

  if (!hasActions) return null;

  const chooseCreate = (kind: NodeKind) => {
    setOpen(false);
    onCreate(parentPath, kind);
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
              {createOptions?.length && (hasRename || hasDelete) ? (
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
  parentPath,
  paperPath,
  tree,
  title,
  counts,
  disabled,
  onCreate,
  onRename,
  onDelete,
  showRename = true,
  showDelete = true,
}: {
  parentPath: string;
  paperPath: string;
  tree: ModelNode[];
  title: string;
  counts?: UnitStatusCounts;
  disabled?: boolean;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onRename?: () => void;
  onDelete?: () => void;
  showRename?: boolean;
  showDelete?: boolean;
}) {
  const showCreate = createMenuOptions(parentPath, paperPath, tree) !== null;

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
        {showCreate ? (
          <SectionCreateMenu
            parentPath={parentPath}
            paperPath={paperPath}
            tree={tree}
            disabled={disabled}
            onCreate={onCreate}
          />
        ) : null}
        {(showRename && onRename) || (showDelete && onDelete) ? (
          <TreeRowActions
            onRename={showRename ? onRename : undefined}
            renameLabel={`Rename ${title}`}
            onDelete={showDelete && onDelete ? onDelete : () => {}}
            deleteLabel={`Delete ${title}`}
          />
        ) : null}
      </div>
      <div className="section-tree-row__meta section-tree-row__meta-menu shrink-0 pr-0.5">
        <SectionRowOverflowMenu
          parentPath={parentPath}
          paperPath={paperPath}
          tree={tree}
          title={title}
          disabled={disabled}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          showRename={showRename}
          showDelete={showDelete}
        />
      </div>
    </>
  );
}
