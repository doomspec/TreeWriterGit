import { useRef } from "react";
import { Search } from "lucide-react";

import { SearchResults } from "@/components/layout/SearchResults";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/modelApi";

export function PaperSearchField({
  paperPath,
  searchQuery,
  onSearchChange,
  onSearchSelect,
  className,
  inputClassName,
  placeholder = "Search this paper…",
}: {
  paperPath: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSelect: (hit: SearchHit) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={anchorRef} className={cn("relative min-w-[8rem] max-w-md flex-1", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder={placeholder}
        value={searchQuery}
        className={cn("ui-input h-8 w-full pl-8", inputClassName)}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <SearchResults
        query={searchQuery}
        root={paperPath}
        onSelect={onSearchSelect}
        anchorRef={anchorRef}
        placement="dropdown"
        className="rounded-md"
      />
    </div>
  );
}
