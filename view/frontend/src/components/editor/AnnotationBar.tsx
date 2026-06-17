import { ChevronLeft, ChevronRight, MessageSquare, StickyNote, X } from "lucide-react";

import { authorColorClass, authorInitials } from "@/components/editor/MarkdownToolbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommentRecord } from "@/modelApi";

type AnnotationItem = CommentRecord & { type?: "comment" | "note" };

function fileLabel(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

function previewText(text: string, max = 72): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

export function AnnotationBar({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: AnnotationItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  if (items.length === 0) return null;

  const current = items[index];
  const isComment = current.type !== "note";
  const typeLabel = isComment ? "Comment" : `Note \\${current.author}{}`;

  return (
    <div
      className="flex h-10 shrink-0 items-center gap-2 border-t border-border bg-card px-3 text-[11px]"
      role="toolbar"
      aria-label="Annotation navigation"
    >
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Previous annotation"
          disabled={index <= 0}
          onClick={() => onIndexChange(index - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="min-w-[3.5rem] text-center font-mono text-[10px] text-muted-foreground">
          {index + 1}/{items.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Next annotation"
          disabled={index >= items.length - 1}
          onClick={() => onIndexChange(index + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {isComment ? (
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        )}
        <span className="shrink-0 font-medium">{typeLabel}</span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
            authorColorClass(current.author),
          )}
          title={current.author}
        >
          {authorInitials(current.author)}
        </span>
        <span className="min-w-0 truncate text-muted-foreground" title={current.text}>
          {previewText(current.text)}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {fileLabel(current.file)} · L{current.line}
        </span>
        {isComment && current.resolved ? (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            resolved
          </span>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        title="Close annotation bar"
        onClick={onClose}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
