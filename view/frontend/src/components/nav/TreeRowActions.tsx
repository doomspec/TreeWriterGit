import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FilePlus, FolderPlus, Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeFloatingMenuTop } from "@/lib/floatingMenuPosition";
import type { NodeKind } from "@/modelApi";

export type TreeRowCreateOption = {
  kind: NodeKind;
  label: string;
  Icon: typeof FolderPlus;
};

function RowCreateMenu({
  options,
  disabled,
  onCreate,
}: {
  options: TreeRowCreateOption[];
  disabled?: boolean;
  onCreate: (kind: NodeKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

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
      const menuHeight = menu?.offsetHeight ?? 80;
      setMenuPosition({
        top: computeFloatingMenuTop(rect, menuHeight),
        right: window.innerWidth - rect.right,
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

  const choose = (kind: NodeKind) => {
    setOpen(false);
    onCreate(kind);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-400"
        title={options.length === 1 ? options[0]!.label : "Add subsection or unit"}
        aria-label={options.length === 1 ? options[0]!.label : "Add subsection or unit"}
        aria-haspopup={options.length > 1 ? "menu" : undefined}
        aria-expanded={options.length > 1 ? open : undefined}
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
      {open && options.length > 1 && menuPosition
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

export function TreeRowActions({
  onDelete,
  deleteLabel,
  onRename,
  renameLabel,
  onDuplicate,
  duplicateLabel,
  createOptions,
  onCreate,
  disabled,
  className,
}: {
  onDelete?: () => void;
  deleteLabel?: string;
  onRename?: () => void;
  renameLabel?: string;
  onDuplicate?: () => void;
  duplicateLabel?: string;
  createOptions?: TreeRowCreateOption[];
  onCreate?: (kind: NodeKind) => void;
  disabled?: boolean;
  className?: string;
}) {
  const showCreate = createOptions && createOptions.length > 0 && onCreate;

  if (!showCreate && !onRename && !onDelete && !onDuplicate) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
        className,
      )}
    >
      {showCreate ? (
        <RowCreateMenu options={createOptions} disabled={disabled} onCreate={onCreate} />
      ) : null}
      {onRename ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-sky-500/15 hover:text-sky-700 dark:hover:text-sky-300"
          aria-label={renameLabel ?? "Rename"}
          title="Rename"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onRename();
          }}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
      {onDuplicate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={duplicateLabel ?? "Duplicate"}
          title="Duplicate"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label={deleteLabel ?? "Remove"}
          title="Remove"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export const TREE_ROW_CREATE_ICONS = {
  section: FolderPlus,
  subsection: FolderPlus,
  unit: FilePlus,
} as const;
