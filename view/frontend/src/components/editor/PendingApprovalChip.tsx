import { Bot, User } from "lucide-react";

import { usePendingChangesSummary } from "@/components/editor/PendingChangesDiff";
import { Button } from "@/components/ui/button";
import { formatPendingAuthorLabel, type DraftPendingSource } from "@/lib/draftApproval";
import { cn } from "@/lib/utils";

/** Compact inline approval chip — author icon, change summary, approve/discard. */
export function PendingApprovalChip({
  pendingSource,
  editedBy,
  aiAssisted = false,
  aiProvider = null,
  approvedBaseline,
  loadedContent,
  current,
  onApprove,
  onDiscard,
  approving = false,
  approveLabel = "Approve",
  inline = false,
  className,
}: {
  pendingSource: DraftPendingSource | null;
  editedBy?: string | null;
  aiAssisted?: boolean;
  aiProvider?: string | null;
  approvedBaseline: string;
  loadedContent: string;
  current: string;
  onApprove: () => void;
  onDiscard: () => void;
  approving?: boolean;
  approveLabel?: string;
  /** Smaller chip for embedding at the start of changed text. */
  inline?: boolean;
  className?: string;
}) {
  const { summary } = usePendingChangesSummary(approvedBaseline, loadedContent, current);

  if (!pendingSource) return null;

  const Icon = pendingSource === "ai" || aiAssisted ? Bot : User;
  const handleLabel = formatPendingAuthorLabel({
    pendingSource,
    editedBy,
    aiAssisted,
    aiProvider,
  });

  return (
    <div
      className={cn(
        "pending-approval-chip inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        inline ? "mr-1.5 px-1.5 py-0.5 text-[9px] align-middle" : "px-2 py-1 text-[10px]",
        className,
      )}
      role="status"
      aria-label={`Pending changes by ${handleLabel}`}
    >
      <Icon className={cn("shrink-0 opacity-80", inline ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden="true" />
      <span className="min-w-0 truncate font-medium">{handleLabel}</span>
      <span className="text-muted-foreground">· {summary}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(inline ? "h-5 px-1 text-[9px]" : "h-6 px-1.5 text-[10px]")}
          disabled={approving}
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn(inline ? "h-5 px-1.5 text-[9px]" : "h-6 px-2 text-[10px]")}
          disabled={approving}
          onClick={onApprove}
        >
          {approving ? "Saving…" : approveLabel}
        </Button>
      </span>
    </div>
  );
}
