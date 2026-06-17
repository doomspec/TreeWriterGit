import { authorColorClass } from "@/components/editor/MarkdownToolbar";
import { cn } from "@/lib/utils";

export function InlineNoteBadge({
  author,
  text,
  className,
}: {
  author: string;
  text: string;
  className?: string;
}) {
  const label = author.toUpperCase();
  return (
    <span
      className={cn(
        "inline-note-badge mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded px-1.5 py-0.5 align-baseline text-[0.92em] leading-snug",
        authorColorClass(author),
        className,
      )}
      title={`${label}: ${text}`}
    >
      <span className="inline-note-badge__tag shrink-0 font-mono text-[0.75em] font-semibold uppercase opacity-80">
        {label}
      </span>
      <span className="inline-note-badge__text">{text}</span>
    </span>
  );
}
