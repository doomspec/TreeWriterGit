import { Link2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LatexRefBadge({ refKey, className }: { refKey: string; className?: string }) {
  return (
    <span
      className={cn("latex-ref-badge", className)}
      title={`\\ref{${refKey}}`}
    >
      <Link2 className="latex-ref-badge__icon" aria-hidden="true" />
      <span className="latex-ref-badge__tag">ref</span>
      <span className="latex-ref-badge__key">{refKey}</span>
    </span>
  );
}
