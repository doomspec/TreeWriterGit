import { Bot, ChevronDown, ChevronUp, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatGitHubHandle, type DraftPendingSource } from "@/lib/draftApproval";
import type { PendingChangeNavigation } from "@/lib/usePendingChangeNavigation";

export function DraftApprovalBar({
  pendingSource,
  editedBy,
  aiAssisted = false,
  onApprove,
  onDiscard,
  approving = false,
  approveLabel = "Approve draft",
  changeNavigation = null,
}: {
  pendingSource: DraftPendingSource | null;
  editedBy?: string | null;
  aiAssisted?: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  approving?: boolean;
  approveLabel?: string;
  changeNavigation?: PendingChangeNavigation | null;
}) {
  const source = pendingSource ?? "human";
  const Icon = source === "ai" || aiAssisted ? Bot : User;
  const handleLabel = formatGitHubHandle(editedBy);
  const editorPart = handleLabel ? `${handleLabel} edited` : "Not yet approved";
  const aiPart = source === "ai" || aiAssisted ? " · AI assisted" : "";
  const message = `${editorPart}${aiPart} — saved for collaborators; approve to mark ready for export.`;
  const shortMessage = `${editorPart}${aiPart} — approve to export`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        <span className="min-w-0 truncate sm:whitespace-normal">
          <span className="sm:hidden">{shortMessage}</span>
          <span className="hidden sm:inline">{message}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {changeNavigation?.canNavigate ? (
          <div
            className="mr-1 flex items-center gap-0.5 rounded-md border border-amber-500/25 bg-background/60 px-0.5"
            role="group"
            aria-label="Navigate track changes"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 px-0"
              title="Previous change (⌥↑)"
              aria-label="Previous change"
              onClick={changeNavigation.goToPrevious}
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <span className="min-w-[3.25rem] text-center text-[10px] tabular-nums text-muted-foreground">
              {changeNavigation.index >= 0
                ? `${changeNavigation.index + 1}/${changeNavigation.count}`
                : `—/${changeNavigation.count}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 px-0"
              title="Next change (⌥↓)"
              aria-label="Next change"
              onClick={changeNavigation.goToNext}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={approving}
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={approving}
          onClick={onApprove}
        >
          {approving ? "Saving…" : (
            <>
              <span className="sm:hidden">Approve</span>
              <span className="hidden sm:inline">{approveLabel}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
