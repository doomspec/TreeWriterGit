import { useState } from "react";
import { ChevronRight, FileText, Folder, Lightbulb, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog, NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { cn } from "@/lib/utils";
import { ApiError, deleteNode, moveNode } from "@/modelApi";
import type { OutlineItem } from "@/lib/modelTree";

export function OutlineList({
  items,
  activeFile,
  onOpenFolder,
  onOpenFile,
  onChanged,
  onError,
}: {
  items: OutlineItem[];
  activeFile: string | null;
  onOpenFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [renameItem, setRenameItem] = useState<OutlineItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<OutlineItem | null>(null);
  const [recursiveDelete, setRecursiveDelete] = useState<OutlineItem | null>(null);

  const runDelete = async (item: OutlineItem, recursive: boolean) => {
    try {
      await deleteNode(item.path, recursive);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    const item = deleteItem;
    setDeleteItem(null);
    try {
      await deleteNode(item.path);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRecursiveDelete(item);
        return;
      }
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const submitRename = async (nextName: string) => {
    if (!renameItem) return;
    const item = renameItem;
    setRenameItem(null);
    const nodePath = item.path;
    const current = nodePath.split("/").at(-1) ?? "";
    if (nextName === current) return;
    const parent = nodePath.split("/").slice(0, -1).join("/");
    const to = parent ? `${parent}/${nextName}` : nextName;
    try {
      await moveNode(nodePath, to);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Name</span>
        <span className="pr-16">Actions</span>
      </div>
      <ul className="divide-y divide-border/60 overflow-auto">
        {items.map((item) => {
          const isActive = activeFile === item.path || (item.kind === "directory" && activeFile?.startsWith(`${item.path}/`));
          const Icon =
            item.kind === "directory"
              ? Folder
              : item.name === "INDEX.md"
                ? Lightbulb
                : FileText;

          return (
            <li key={item.id}>
              <div
                className={cn(
                  "group grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5 transition-colors hover:bg-accent/40",
                  isActive && "bg-primary/5",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={() => {
                    if (item.kind === "directory") {
                      onOpenFolder(item.path);
                    } else {
                      onOpenFile(item.path);
                    }
                  }}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      item.kind === "directory" ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">{item.subtitle}</div>
                  </div>
                  {item.kind === "directory" ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  ) : null}
                </button>

                {item.kind !== "index" ? (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Rename ${item.name}`}
                      title="Rename"
                      onClick={() => setRenameItem(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Delete ${item.name}`}
                      title="Delete"
                      onClick={() => setDeleteItem(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <span className="w-16" />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <NamePromptDialog
        open={renameItem !== null}
        title="Rename"
        label="New name"
        defaultValue={renameItem?.path.split("/").at(-1)?.replace(/\.md$/, "") ?? ""}
        confirmLabel="Rename"
        onConfirm={(name) => void submitRename(name)}
        onCancel={() => setRenameItem(null)}
      />
      <ConfirmDialog
        open={deleteItem !== null}
        title="Delete"
        message={deleteItem ? `Delete ${deleteItem.path}?` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteItem(null)}
      />
      <ConfirmDialog
        open={recursiveDelete !== null}
        title="Delete recursively"
        message={recursiveDelete ? `${recursiveDelete.path} is not empty. Delete all contents?` : ""}
        confirmLabel="Delete all"
        destructive
        onConfirm={() => {
          const item = recursiveDelete;
          setRecursiveDelete(null);
          if (item) void runDelete(item, true);
        }}
        onCancel={() => setRecursiveDelete(null)}
      />
    </div>
  );
}
