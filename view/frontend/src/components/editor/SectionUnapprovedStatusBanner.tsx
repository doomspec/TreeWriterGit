import { useMemo } from "react";

import {
  containerHasDraftPending,
  pendingChildApprovalPaths,
  useDraftPendingPaths,
} from "@/lib/draftPendingStore";
import { hasUnapprovedUnits } from "@/lib/unapprovedHighlight";
import type { UnitStatusCounts } from "@/modelApi";

export function SectionUnapprovedStatusBanner({
  sectionPath,
  counts,
}: {
  sectionPath: string;
  counts?: UnitStatusCounts;
}) {
  const pendingPaths = useDraftPendingPaths();
  const childPending = useMemo(
    () => pendingChildApprovalPaths(sectionPath, pendingPaths),
    [pendingPaths, sectionPath],
  );

  if (!hasUnapprovedUnits(counts)) return null;
  if (childPending.length > 0 || containerHasDraftPending(sectionPath)) return null;

  const drafted = counts?.drafted ?? 0;
  const outline = counts?.outline ?? 0;
  const parts: string[] = [];
  if (drafted > 0) {
    parts.push(`${drafted} drafted`);
  }
  if (outline > 0) {
    parts.push(`${outline} outline-only`);
  }

  return (
    <div
      className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-950 dark:text-amber-100"
      role="status"
    >
      {parts.length > 0 ? (
        <>
          This section has {parts.join(" and ")} unit{counts!.total === 1 ? "" : "s"} not marked
          approved. Open child units in the paper tree to review and approve their drafts.
        </>
      ) : (
        <>Some child units in this section are not marked approved. Open them from the paper tree.</>
      )}
    </div>
  );
}
