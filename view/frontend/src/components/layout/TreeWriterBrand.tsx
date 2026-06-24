import { TerminalSquare } from "lucide-react";

import { cn } from "@/lib/utils";

export function TreeWriterBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="hidden text-sm font-semibold tracking-tight sm:inline">TreeWriter</span>
    </div>
  );
}
