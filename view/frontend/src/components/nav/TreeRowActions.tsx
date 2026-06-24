import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TreeRowActions({
  onDelete,
  deleteLabel,
  onRename,
  renameLabel,
  className,
}: {
  onDelete: () => void;
  deleteLabel: string;
  onRename?: () => void;
  renameLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto", className)}>
      {onRename ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-sky-500/15 hover:text-sky-700 dark:hover:text-sky-300"
          aria-label={renameLabel ?? "Rename"}
          title="Rename"
          onClick={(event) => {
            event.stopPropagation();
            onRename();
          }}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        aria-label={deleteLabel}
        title="Remove"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3 text-destructive" aria-hidden="true" />
      </Button>
    </div>
  );
}
