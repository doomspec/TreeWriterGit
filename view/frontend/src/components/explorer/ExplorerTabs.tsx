import { X } from "lucide-react";

import { cn } from "@/lib/utils";

function basename(path: string): string {
  return path.split("/").pop() || path;
}

/** Chrome-style tab strip for the files open in Explorer mode. */
export function ExplorerTabs({
  tabs,
  activeTab,
  onSelect,
  onClose,
}: {
  tabs: string[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      className="flex h-[var(--workspace-pane-header-height,2.25rem)] shrink-0 items-stretch overflow-x-auto border-b border-border bg-card"
      style={{ scrollbarWidth: "thin" }}
    >
      {tabs.map((path) => {
        const active = path === activeTab;
        return (
          <div
            key={path}
            role="tab"
            aria-selected={active}
            title={path}
            onClick={() => onSelect(path)}
            className={cn(
              "group flex min-w-0 max-w-[16rem] cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs",
              active
                ? "bg-background text-foreground"
                : "bg-card text-muted-foreground hover:bg-accent/50",
            )}
          >
            <span className="truncate">{basename(path)}</span>
            <button
              type="button"
              aria-label={`Close ${basename(path)}`}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted",
                active ? "opacity-70" : "opacity-0 group-hover:opacity-70",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onClose(path);
              }}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
