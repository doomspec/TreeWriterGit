import { FilePlus, FolderPlus, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExplorerTreeRowActions({
  showCreate,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  disabled,
  className,
}: {
  showCreate?: boolean;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (!showCreate && !onRename && !onDelete) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
        className,
      )}
    >
      {showCreate && onCreateFile ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-400"
          title="New file"
          aria-label="New file"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onCreateFile();
          }}
        >
          <FilePlus className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
      {showCreate && onCreateFolder ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-400"
          title="New folder"
          aria-label="New folder"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onCreateFolder();
          }}
        >
          <FolderPlus className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
      {onRename ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-sky-500/15 hover:text-sky-700 dark:hover:text-sky-300"
          title="Rename"
          aria-label="Rename"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onRename();
          }}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          title="Delete"
          aria-label="Delete"
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
