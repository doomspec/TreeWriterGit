import { Bot, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatGitHubHandle, type DraftPendingSource } from "@/lib/draftApproval";

export function DraftApprovalBar({
  pendingSource,
  editedBy,
  aiAssisted = false,
  onApprove,
  onDiscard,
  approving = false,
  approveLabel = "Approve draft",
}: {
  pendingSource: DraftPendingSource | null;
  editedBy?: string | null;
  aiAssisted?: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  approving?: boolean;
  approveLabel?: string;
}) {
  if (!pendingSource) return null;

  const Icon = pendingSource === "ai" || aiAssisted ? Bot : User;
  const handleLabel = formatGitHubHandle(editedBy);
  const editorPart = handleLabel ? `${handleLabel} edited` : "Unsaved edit";
  const aiPart = pendingSource === "ai" || aiAssisted ? " · AI assisted" : "";
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
