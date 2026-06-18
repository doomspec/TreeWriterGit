import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TreeRowActions({
  onDelete,
  deleteLabel,
  className,
}: {
  onDelete: () => void;
  deleteLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
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
