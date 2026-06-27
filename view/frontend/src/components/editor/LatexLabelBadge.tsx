import { Tag } from "lucide-react";

import { cn } from "@/lib/utils";

export function LatexLabelBadge({ labelKey, className }: { labelKey: string; className?: string }) {
  return (
    <span
      className={cn("latex-label-badge", className)}
      title={`\\label{${labelKey}}`}
    >
      <Tag className="latex-label-badge__icon" aria-hidden="true" />
      <span className="latex-label-badge__tag">label</span>
      <span className="latex-label-badge__key">{labelKey}</span>
    </span>
  );
}
