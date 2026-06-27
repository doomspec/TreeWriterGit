import type { UnitStatusCounts } from "@/modelApi";

import { containerHasDraftPending } from "@/lib/draftPendingStore";
import { cn } from "@/lib/utils";

/** Shown on hover for approved/drafted/outline roll-up numbers in the section tree. */
export const UNIT_STATUS_COUNTS_HINT =
  "Units in this section: approved / drafted / outline-only";

export function hasUnapprovedUnits(counts?: UnitStatusCounts): boolean {
  if (!counts || counts.total === 0) return false;
  return counts.approved < counts.total;
}

export function sectionNeedsHighlight(
  containerPath: string,
  counts?: UnitStatusCounts,
): { unapproved: boolean; pending: boolean; highlight: boolean } {
  const unapproved = hasUnapprovedUnits(counts);
  const pending = containerHasDraftPending(containerPath);
  return { unapproved, pending, highlight: unapproved || pending };
}

export function unapprovedSectionRowClass(options: {
  highlight: boolean;
  pending: boolean;
  active?: boolean;
  compact?: boolean;
}): string {
  const { highlight, pending, active, compact } = options;
  return cn(
    highlight && !active && (compact ? "bg-amber-500/10" : "border-amber-500/45 bg-amber-500/10"),
    highlight && active && (compact ? "bg-amber-500/15" : "border-amber-500/50 bg-amber-500/15"),
    pending && "ring-1 ring-amber-500/55 ring-inset",
    highlight && !compact && "border-amber-500/40",
    highlight && compact && "border border-amber-500/35",
  );
}

export function unapprovedSectionTitle(title: string, highlight: boolean): string {
  return cn("truncate", highlight && "text-amber-950 dark:text-amber-50");
}
