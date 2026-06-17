import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { breadcrumbSegments, papersBreadcrumbSegments } from "@/lib/modelTree";

export function Breadcrumbs({
  path,
  onNavigate,
  compact = false,
  variant = "default",
}: {
  path: string;
  onNavigate: (path: string) => void;
  compact?: boolean;
  variant?: "default" | "papers";
}) {
  const segments = variant === "papers" ? papersBreadcrumbSegments(path) : breadcrumbSegments(path);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex min-w-0 items-center gap-0.5", compact ? "text-xs" : "text-sm")}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={segment.path || "root"} className="flex min-w-0 items-center gap-0.5">
            {index > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            ) : null}
            <button
              type="button"
              disabled={isLast}
              className={cn(
                "truncate rounded px-1 py-0.5 font-medium transition-colors",
                isLast
                  ? "cursor-default text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              onClick={() => !isLast && onNavigate(segment.path)}
            >
              {segment.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
