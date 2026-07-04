import type { DocumentType } from "@/modelApi";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "paper", "grant", "report"] as const;

/** Doc-type filter pill row shared by the manuscript selector and the paper-info panel. */
export function DocTypeFilterChips({
  value,
  onChange,
  className,
}: {
  value: DocumentType | "all";
  onChange: (value: DocumentType | "all") => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-0.5", className)}>
      {FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px]",
            value === filter ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
          )}
          onClick={() => onChange(filter)}
        >
          {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
        </button>
      ))}
    </div>
  );
}
