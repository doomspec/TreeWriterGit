import { normalizeHighlightColor } from "@/lib/textHighlight";
import { cn } from "@/lib/utils";

export function TextHighlightBadge({
  color,
  text,
  className,
}: {
  color: string;
  text: string;
  className?: string;
}) {
  const normalized = normalizeHighlightColor(color);
  return (
    <mark
      className={cn(
        "text-highlight-badge",
        `text-highlight-${normalized}`,
        className,
      )}
    >
      {text}
    </mark>
  );
}
