import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Collapsible sidebar section — matches Assistant panel Skills / Terminal headers. */
export function SidebarCollapsibleSection({
  title,
  icon: Icon,
  open,
  defaultOpen = true,
  onOpenChange,
  badge,
  headerActions,
  children,
  className,
  contentClassName,
  first = false,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Omit top border on the first section in a stack. */
  first?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const setIsOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section
      className={cn(
        "flex min-h-0 shrink-0 flex-col",
        !first && "border-t border-border",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-stretch">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left hover:bg-accent/40"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <span className="ui-label min-w-0 flex-1 truncate normal-case">{title}</span>
          {badge}
        </button>
        {headerActions ? (
          <div className="flex shrink-0 items-center pr-1">{headerActions}</div>
        ) : null}
      </div>
      {isOpen ? (
        <div className={cn("space-y-2 px-2 pb-2.5 pt-0.5", contentClassName)}>{children}</div>
      ) : null}
    </section>
  );
}
