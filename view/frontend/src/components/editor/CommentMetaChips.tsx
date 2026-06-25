import { Bot, User } from "lucide-react";

import { authorColorClass, authorInitials } from "@/components/editor/MarkdownToolbar";
import { cn } from "@/lib/utils";
import type { CommentAssignee } from "@/modelApi";

export function CommentAuthorChip({ author, className }: { author: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
        authorColorClass(author),
        className,
      )}
      title={author}
    >
      {authorInitials(author)}
    </span>
  );
}

export function AssigneeBadge({
  assignee,
  compact = false,
  className,
}: {
  assignee: CommentAssignee;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary",
          className,
        )}
        title={`Assigned to ${assignee.label}`}
      >
        {assignee.type === "ai" ? (
          <Bot className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <User className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        {assignee.label}
      </span>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-1 text-[10px] text-muted-foreground", className)}
      title={`Assigned to ${assignee.label}`}
    >
      {assignee.type === "ai" ? (
        <Bot className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : (
        <User className="h-3 w-3 shrink-0" aria-hidden="true" />
      )}
      <span>
        Assigned to <strong className="font-medium text-foreground">{assignee.label}</strong>
      </span>
    </div>
  );
}
