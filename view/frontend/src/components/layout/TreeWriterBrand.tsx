import { TerminalSquare } from "lucide-react";

import { cn } from "@/lib/utils";

export function TreeWriterBrand({
  className,
  onHomeClick,
  homeTitle = "Home",
}: {
  className?: string;
  onHomeClick?: () => void;
  homeTitle?: string;
}) {
  const content = (
    <>
      <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="hidden text-sm font-semibold tracking-tight sm:inline">TreeWriter</span>
    </>
  );

  if (!onHomeClick) {
    return <div className={cn("flex shrink-0 items-center gap-1.5", className)}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onHomeClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 -ml-1 text-foreground transition-colors",
        "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={homeTitle}
      title={homeTitle}
    >
      {content}
    </button>
  );
}
