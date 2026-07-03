import { useMemo } from "react";

import {
  countPendingDisplayChanges,
  pendingChangesRows,
  type InlineSegment,
  type PendingLineHighlight,
} from "@/lib/draftDiff";
import { cn } from "@/lib/utils";

function PendingInlineSegments({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.text ? (
          <span
            key={index}
            className={
              segment.kind === "insert"
                ? "pending-changes-diff__word--insert"
                : segment.kind === "delete"
                  ? "pending-changes-diff__word--delete"
                  : undefined
            }
          >
            {segment.text}
          </span>
        ) : null,
      )}
    </>
  );
}

export function PendingChangeLine({ row }: { row: PendingLineHighlight }) {
  if (row.kind === "delete") {
    return (
      <div className="pending-changes-diff__line pending-changes-diff__line--delete rounded-sm px-1">
        <span className="select-none opacity-50">−</span>
        {row.text.length > 0 ? row.text : "\u00a0"}
      </div>
    );
  }

  if (row.kind === "inline") {
    const hasDelete = row.segments.some((segment) => segment.kind === "delete");
    const hasInsert = row.segments.some((segment) => segment.kind === "insert");
    const lineClass =
      hasDelete && hasInsert
        ? "pending-changes-diff__line--mixed"
        : hasDelete
          ? "pending-changes-diff__line--delete"
          : "pending-changes-diff__line--insert";

    return (
      <div className={cn("pending-changes-diff__line rounded-sm px-1", lineClass)}>
        <span className="select-none opacity-50">{hasDelete && hasInsert ? "±" : hasDelete ? "−" : "+"}</span>
        <PendingInlineSegments segments={row.segments} />
      </div>
    );
  }

  return (
    <div className="pending-changes-diff__line pending-changes-diff__line--insert rounded-sm px-1">
      <span className="select-none opacity-50">+</span>
      {row.text.length > 0 ? row.text : "\u00a0"}
    </div>
  );
}

export function PendingChangesDiff({
  approvedBaseline,
  loadedContent,
  current,
  comfortable = false,
  className,
}: {
  approvedBaseline: string | null;
  loadedContent: string;
  current: string;
  comfortable?: boolean;
  className?: string;
}) {
  const rows = useMemo(
    () => pendingChangesRows(approvedBaseline, loadedContent, current),
    [approvedBaseline, current, loadedContent],
  );

  if (rows.length === 0) {
    return <p className="text-[10px] text-muted-foreground">No diff rows.</p>;
  }

  return (
    <pre
      className={cn(
        "pending-changes-diff whitespace-pre-wrap break-words font-mono",
        comfortable ? "text-xs leading-6" : "text-[10px] leading-5",
        className,
      )}
    >
      {rows.map((row, index) => (
        <PendingChangeLine key={index} row={row} />
      ))}
    </pre>
  );
}

export function usePendingChangesSummary(
  approvedBaseline: string | null,
  loadedContent: string,
  current: string,
): { summary: string; hasChanges: boolean } {
  const rows = useMemo(
    () => pendingChangesRows(approvedBaseline, loadedContent, current),
    [approvedBaseline, current, loadedContent],
  );
  const counts = useMemo(
    () => countPendingDisplayChanges(approvedBaseline, loadedContent, current),
    [approvedBaseline, current, loadedContent],
  );

  if (rows.length === 0) {
    return { summary: "Pending approval", hasChanges: false };
  }

  const summary =
    counts.changedWords > 0
      ? `${counts.changedWords} word${counts.changedWords === 1 ? "" : "s"}`
      : `${counts.changedLines} line${counts.changedLines === 1 ? "" : "s"}`;

  return { summary, hasChanges: true };
}
