import { useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clearDraftPendingPaths,
  pendingChildApprovalPaths,
  replaceServerDraftPendingPaths,
  useDraftPendingPaths,
} from "@/lib/draftPendingStore";
import { getGitHubHandle } from "@/lib/userIdentity";
import { cn } from "@/lib/utils";
import { approveDraftChildren, fetchPaperDetail } from "@/modelApi";

function paperSlugFromSectionPath(sectionPath: string): string | null {
  const match = sectionPath.match(/^papers\/([^/]+)/);
  return match?.[1] ?? null;
}

async function refreshPaperPendingPaths(sectionPath: string): Promise<void> {
  const slug = paperSlugFromSectionPath(sectionPath);
  if (!slug) return;
  try {
    const data = await fetchPaperDetail(slug);
    replaceServerDraftPendingPaths(data.paper.pendingApprovalPaths ?? []);
  } catch {
    replaceServerDraftPendingPaths([]);
  }
}

export function SectionApproveChildrenButton({
  sectionPath,
  disabled = false,
  onApproved,
  onError,
  inline = false,
  className,
}: {
  sectionPath: string;
  disabled?: boolean;
  onApproved?: () => void;
  onError?: (message: string) => void;
  /** Compact chip for embedding above draft content. */
  inline?: boolean;
  className?: string;
}) {
  const pendingPaths = useDraftPendingPaths();
  const childPending = useMemo(
    () => pendingChildApprovalPaths(sectionPath, pendingPaths),
    [pendingPaths, sectionPath],
  );
  const [approving, setApproving] = useState(false);

  if (childPending.length === 0) return null;

  const summary =
    childPending.length === 1
      ? "1 child unit pending approval"
      : `${childPending.length} child units pending approval`;

  const handleApproveAll = async () => {
    setApproving(true);
    try {
      const result = await approveDraftChildren(sectionPath, getGitHubHandle() || null);
      const cleared = new Set(childPending);
      for (const rel of result.updated) {
        if (rel.endsWith("/draft.md") || rel.endsWith("/outline.md")) {
          cleared.add(rel);
        }
      }
      clearDraftPendingPaths(cleared);
      await refreshPaperPendingPaths(sectionPath);
      onApproved?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(false);
    }
  };

  return (
    <div
      className={cn(
        "pending-approval-chip inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        inline ? "mb-2 px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
        className,
      )}
      role="status"
      aria-label={summary}
    >
      <CheckCheck
        className={cn("shrink-0 opacity-80", inline ? "h-3 w-3" : "h-3.5 w-3.5")}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate font-medium">{summary}</span>
      <Button
        type="button"
        size="sm"
        className={cn(inline ? "h-5 px-1.5 text-[9px]" : "h-6 px-2 text-[10px]")}
        disabled={disabled || approving}
        onClick={() => void handleApproveAll()}
        title="Approve all pending drafts and outlines in child units and subsections"
      >
        {approving ? "Approving…" : inline ? "Approve all" : `Approve all in children (${childPending.length})`}
      </Button>
    </div>
  );
}
