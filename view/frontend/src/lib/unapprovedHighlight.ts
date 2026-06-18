import type { UnitStatusCounts } from "@/modelApi";

import { containerHasDraftPending } from "@/lib/draftPendingStore";
import { cn } from "@/lib/utils";

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
    highlight && !active && "border-amber-500/45 bg-amber-500/10",
    highlight && active && "border-amber-500/50 bg-amber-500/15",
    pending && "ring-1 ring-amber-500/55 ring-inset",
    compact ? undefined : highlight && "border-amber-500/40",
  );
}

export function unapprovedSectionTitle(title: string, highlight: boolean): string {
  return cn("truncate", highlight && "text-amber-950 dark:text-amber-50");
}
