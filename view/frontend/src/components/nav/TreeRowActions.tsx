import { Plus, Trash2 } from "lucide-react";

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

export function TreeCreateButtons({
  onCreateSection,
  onCreateSubsection,
  onCreateUnit,
  showSection = false,
  showSubsection = false,
  showUnit = false,
  compact = false,
}: {
  onCreateSection?: () => void;
  onCreateSubsection?: () => void;
  onCreateUnit?: () => void;
  showSection?: boolean;
  showSubsection?: boolean;
  showUnit?: boolean;
  compact?: boolean;
}) {
  const btnClass = compact ? "h-6 gap-1 px-1.5 text-[9px]" : "h-7 gap-1 px-2 text-[10px]";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {showSection && onCreateSection ? (
        <Button type="button" variant="outline" size="sm" className={btnClass} onClick={onCreateSection}>
          <Plus className="h-3 w-3" aria-hidden="true" />
          Section
        </Button>
      ) : null}
      {showSubsection && onCreateSubsection ? (
        <Button type="button" variant="outline" size="sm" className={btnClass} onClick={onCreateSubsection}>
          <Plus className="h-3 w-3" aria-hidden="true" />
          Subsection
        </Button>
      ) : null}
      {showUnit && onCreateUnit ? (
        <Button type="button" variant="outline" size="sm" className={btnClass} onClick={onCreateUnit}>
          <Plus className="h-3 w-3" aria-hidden="true" />
          Unit
        </Button>
      ) : null}
    </div>
  );
}
