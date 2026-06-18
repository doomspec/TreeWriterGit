import { useMemo } from "react";

import { countPendingChanges, diffLineOps } from "@/lib/draftDiff";
import { cn } from "@/lib/utils";

export function PendingChangesPanel({
  baseline,
  current,
  className,
}: {
  baseline: string;
  current: string;
  className?: string;
}) {
  const ops = useMemo(() => diffLineOps(baseline, current), [baseline, current]);
  const counts = useMemo(() => countPendingChanges(baseline, current), [baseline, current]);

  if (baseline === current) return null;

  return (
    <div
      className={cn(
        "border-b border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-foreground",
        className,
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-100/90">
          Unapproved changes
        </span>
        {counts.inserts > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400/70" aria-hidden="true" />
            {counts.inserts} added/changed
          </span>
        ) : null}
        {counts.deletes > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400/60" aria-hidden="true" />
            {counts.deletes} removed
          </span>
        ) : null}
      </div>
      <pre className="pending-changes-diff max-h-36 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5">
        {ops.map((op, index) => (
          <div
            key={index}
            className={cn(
              "pending-changes-diff__line rounded-sm px-1",
              op.kind === "insert" && "pending-changes-diff__line--insert",
              op.kind === "delete" && "pending-changes-diff__line--delete",
            )}
          >
            <span className="select-none opacity-50">{op.kind === "delete" ? "−" : op.kind === "insert" ? "+" : " "}</span>
            {op.text.length > 0 ? op.text : "\u00a0"}
          </div>
        ))}
      </pre>
    </div>
  );
}
