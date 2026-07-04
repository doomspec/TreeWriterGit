import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { cn } from "@/lib/utils";

type VerificationStatus = "verified" | "stale" | "unverified";

export function BibVerificationBadge({
  status,
  large = false,
}: {
  status: VerificationStatus;
  large?: boolean;
}) {
  const Icon =
    status === "verified" ? ShieldCheck : status === "stale" ? ShieldAlert : ShieldQuestion;
  const label = status === "verified" ? "Verified" : status === "stale" ? "Stale" : "Unverified";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border font-medium uppercase tracking-normal",
        large ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[9px]",
        status === "verified" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "stale" &&
          "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        status === "unverified" &&
          "border-border bg-muted/40 text-muted-foreground",
      )}
      title={label}
    >
      <Icon className={large ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden="true" />
      {label}
    </span>
  );
}

export function BibVerificationCounts({
  verified,
  stale,
  unverified,
}: {
  verified: number;
  stale: number;
  unverified: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 text-[10px]">
      <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1 text-emerald-700 dark:text-emerald-300">
        {verified} verified
      </span>
      <span className="rounded-sm border border-amber-500/35 bg-amber-500/10 px-1.5 py-1 text-amber-700 dark:text-amber-300">
        {stale} stale
      </span>
      <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-1 text-muted-foreground">
        {unverified} open
      </span>
    </div>
  );
}
