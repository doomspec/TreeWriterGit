import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";

export function CiteBadge({
  citeKey,
  className,
  onOpen,
}: {
  citeKey: string;
  className?: string;
  onOpen?: (citeKey: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn("latex-cite-badge", onOpen && "latex-cite-badge--clickable", className)}
      title={`\\cite{${citeKey}}`}
      onClick={onOpen ? () => onOpen(citeKey) : undefined}
    >
      <BookOpen className="latex-cite-badge__icon" aria-hidden="true" />
      <span className="latex-cite-badge__tag">cite</span>
      <span className="latex-cite-badge__key">{citeKey}</span>
    </button>
  );
}
