import { FolderTree, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";

const MODES: {
  explorer: boolean;
  label: string;
  icon: typeof PenLine;
}[] = [
  { explorer: false, label: "Write", icon: PenLine },
  { explorer: true, label: "Explorer", icon: FolderTree },
];

/** Segmented switch between Write and Explorer — Claude-style mode toggle. */
export function WorkspaceModePill({
  explorerMode,
  onChange,
  className,
}: {
  explorerMode: boolean;
  onChange: (explorer: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-0.5 rounded-md bg-muted/70 p-0.5",
        className,
      )}
      role="group"
      aria-label="Switch workspace mode"
    >
      {MODES.map((mode) => {
        const active = explorerMode === mode.explorer;
        const Icon = mode.icon;
        return (
          <button
            key={mode.label}
            type="button"
            className={cn(
              "flex h-full min-w-0 flex-1 items-center justify-center gap-1 rounded-sm px-1.5 text-[10px] font-medium leading-none transition-all",
              active
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
            aria-label={mode.label}
            onClick={() => onChange(mode.explorer)}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
