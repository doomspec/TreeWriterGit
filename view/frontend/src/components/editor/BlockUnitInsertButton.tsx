import { Plus } from "lucide-react";

import { PopoverMenu, PopoverMenuItem, PopoverMenuSection } from "@/components/ui/PopoverMenu";
import { cn } from "@/lib/utils";

export function BlockUnitInsertButton({
  className,
  onAddUnit,
  onAddSubsection,
}: {
  className?: string;
  onAddUnit: () => void;
  onAddSubsection: () => void;
}) {
  return (
    <div
      className={cn("block-unit-insert-button", className)}
      onMouseDown={(event) => event.preventDefault()}
    >
      <PopoverMenu
        align="end"
        aria-label="Add structure"
        title="Add unit or subsection"
        triggerClassName="h-6 w-6 rounded-full border border-border/70 bg-card/95 px-0 shadow-sm hover:bg-accent"
        trigger={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
      >
        <PopoverMenuSection label="Insert below">
          <PopoverMenuItem onClick={onAddUnit}>Add unit</PopoverMenuItem>
          <PopoverMenuItem onClick={onAddSubsection}>Add subsection</PopoverMenuItem>
        </PopoverMenuSection>
      </PopoverMenu>
    </div>
  );
}
