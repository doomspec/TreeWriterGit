import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("animate-pulse space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={cn(
            "h-3 rounded-sm bg-muted",
            index === lines - 1 ? "w-2/3" : "w-full",
          )}
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
