import { Bot, User } from "lucide-react";

import { PendingChangesDiff, usePendingChangesSummary } from "@/components/editor/PendingChangesDiff";
import { Button } from "@/components/ui/button";
import { formatGitHubHandle, type DraftPendingSource } from "@/lib/draftApproval";
import { cn } from "@/lib/utils";

export function DraftApprovalRail({
  pendingSource,
  editedBy,
  aiAssisted = false,
  onApprove,
  onDiscard,
  approving = false,
  approveLabel = "Approve draft",
  approvedBaseline,
  loadedContent,
  current,
  className,
}: {
  pendingSource: DraftPendingSource | null;
  editedBy?: string | null;
  aiAssisted?: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  approving?: boolean;
  approveLabel?: string;
  approvedBaseline: string;
  loadedContent: string;
  current: string;
  className?: string;
}) {
  const { summary } = usePendingChangesSummary(approvedBaseline, loadedContent, current);

  if (!pendingSource) return null;

  const Icon = pendingSource === "ai" || aiAssisted ? Bot : User;
  const handleLabel = formatGitHubHandle(editedBy);

  return (
    <aside
      className={cn("draft-approval-rail", className)}
      aria-label="Unapproved changes"
    >
      <div className="draft-approval-rail__header">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/90 dark:text-amber-100/90">
            Track changes
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {handleLabel ? `${handleLabel} · ` : ""}
            {summary}
          </p>
        </div>
      </div>

      <div className="draft-approval-rail__diff min-h-0 flex-1 overflow-y-auto">
        <PendingChangesDiff
          approvedBaseline={approvedBaseline}
          loadedContent={loadedContent}
          current={current}
        />
      </div>

      <div className="draft-approval-rail__actions">
        <Button
          type="button"
          size="sm"
          className="h-8 w-full text-[10px]"
          disabled={approving}
          onClick={onApprove}
        >
          {approving ? "Saving…" : approveLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full text-[10px]"
          disabled={approving}
          onClick={onDiscard}
        >
          Discard
        </Button>
      </div>
    </aside>
  );
}
