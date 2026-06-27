import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  PendingChangesDiff,
  usePendingChangesSummary,
} from "@/components/editor/PendingChangesDiff";
import { pendingChangesRows } from "@/lib/draftDiff";
import { cn } from "@/lib/utils";

export function PendingChangesPanel({
  approvedBaseline,
  loadedContent,
  current,
  className,
  defaultExpanded = false,
}: {
  approvedBaseline: string;
  loadedContent: string;
  current: string;
  className?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rows = useMemo(
    () => pendingChangesRows(approvedBaseline, loadedContent, current),
    [approvedBaseline, current, loadedContent],
  );
  const { summary } = usePendingChangesSummary(approvedBaseline, loadedContent, current);

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "border-b border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-foreground",
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 text-left text-[10px] text-muted-foreground"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-100/90">
          <ChevronDown
            className={cn("h-3 w-3 shrink-0 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
          Unapproved changes
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400/70" aria-hidden="true" />
          {summary} changed
        </span>
      </button>
      {expanded ? (
        <PendingChangesDiff
          approvedBaseline={approvedBaseline}
          loadedContent={loadedContent}
          current={current}
          className="mt-1.5 max-h-36 overflow-auto"
        />
      ) : null}
    </div>
  );
}
