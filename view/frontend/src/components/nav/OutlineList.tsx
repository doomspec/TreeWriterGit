import { ChevronRight, FileText, Folder, Lightbulb, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const handleDelete = async (item: OutlineItem) => {
    const nodePath = item.kind === "directory" ? item.path : item.path;
    if (!window.confirm(`Delete ${nodePath}?`)) return;
    try {
      await deleteNode(nodePath);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        if (window.confirm(`${nodePath} is not empty. Delete recursively?`)) {
          try {
            await deleteNode(nodePath, true);
            onChanged();
          } catch (recursiveErr) {
            onError(recursiveErr instanceof Error ? recursiveErr.message : String(recursiveErr));
          }
        }
        return;
      }
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRename = async (item: OutlineItem) => {
    const nodePath = item.kind === "directory" ? item.path : item.path;
    const current = nodePath.split("/").at(-1) ?? "";
    const next = window.prompt(`Rename ${nodePath} to:`, current);
    if (!next || next === current || next.includes("/")) return;
    const parent = nodePath.split("/").slice(0, -1).join("/");
    const to = parent ? `${parent}/${next}` : next;
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
                      onClick={() => void handleRename(item)}
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
                      onClick={() => void handleDelete(item)}
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
    </div>
  );
}
