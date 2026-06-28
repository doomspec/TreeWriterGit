import { useCallback, useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronRight, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { approveDraftAtPath, discardDraftAtPath } from "@/lib/draftApproval";
import {
  authorGroupBorderColor,
  formatReviewChangeSummary,
  type PendingReviewAuthorGroup,
} from "@/lib/pendingReviews";
import { usePaperPendingReviews } from "@/lib/usePaperPendingReviews";
import { cn } from "@/lib/utils";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import type { PendingReviewItem } from "@treewriter/shared";

type ReviewFilter = "all" | "ai" | string;

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function ReviewRow({
  item,
  busy,
  onOpen,
  onApprove,
  onDiscard,
}: {
  item: PendingReviewItem;
  busy: boolean;
  onOpen: (item: PendingReviewItem) => void;
  onApprove: (item: PendingReviewItem) => void;
  onDiscard: (item: PendingReviewItem) => void;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{item.unitTitle}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="rounded bg-muted px-1 py-0.5 uppercase tracking-wide">
              {item.kind}
            </span>
            <span>{formatReviewChangeSummary(item)}</span>
            {item.editedAt ? <span>{formatRelativeTime(item.editedAt)}</span> : null}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          disabled={busy}
          onClick={() => onOpen(item)}
        >
          Open
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-[10px]"
          disabled={busy}
          onClick={() => onApprove(item)}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          disabled={busy}
          onClick={() => onDiscard(item)}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

function AuthorGroupSection({
  group,
  open,
  busy,
  onToggle,
  onOpen,
  onApprove,
  onDiscard,
  onApproveAll,
  onDiscardAll,
}: {
  group: PendingReviewAuthorGroup;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: (item: PendingReviewItem) => void;
  onApprove: (item: PendingReviewItem) => void;
  onDiscard: (item: PendingReviewItem) => void;
  onApproveAll: (group: PendingReviewAuthorGroup) => void;
  onDiscardAll: (group: PendingReviewAuthorGroup) => void;
}) {
  const Icon = group.isAi ? Bot : User;
  const borderColor = authorGroupBorderColor(group.authorKey);

  return (
    <section
      className="overflow-hidden rounded-md border border-border/70 bg-card/40"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-accent/40"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{group.label}</span>
        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-100">
          {group.items.length}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border/60 px-2 py-2">
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              className="h-7 text-[10px]"
              disabled={busy}
              onClick={() => onApproveAll(group)}
            >
              Approve all ({group.items.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              disabled={busy}
              onClick={() => onDiscardAll(group)}
            >
              Discard all
            </Button>
          </div>
          {group.items.map((item) => (
            <ReviewRow
              key={item.path}
              item={item}
              busy={busy}
              onOpen={onOpen}
              onApprove={onApprove}
              onDiscard={onDiscard}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ApprovalReviewPanel({ className }: { className?: string }) {
  const nav = useWorkspaceNavigationContext();
  const { items, groups, loading, reload, totalCount } = usePaperPendingReviews(
    nav.paperSlug,
    nav.refreshVersion,
  );
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const filterOptions = useMemo(() => {
    const authors = groups.filter((group) => !group.isAi);
    return [
      { id: "all" as const, label: "All" },
      { id: "ai" as const, label: "AI agents" },
      ...authors.map((group) => ({ id: group.authorKey, label: group.label })),
    ];
  }, [groups]);

  const visibleGroups = useMemo(() => {
    if (filter === "all") return groups;
    if (filter === "ai") return groups.filter((group) => group.isAi);
    return groups.filter((group) => group.authorKey === filter);
  }, [filter, groups]);

  const toggleGroup = useCallback((authorKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(authorKey)) next.delete(authorKey);
      else next.add(authorKey);
      return next;
    });
  }, []);

  const handleOpen = useCallback(
    (item: PendingReviewItem) => {
      nav.openFile(item.path);
    },
    [nav],
  );

  const runForItem = useCallback(
    async (item: PendingReviewItem, action: "approve" | "discard") => {
      setBusy(true);
      try {
        if (action === "approve") await approveDraftAtPath(item.path);
        else await discardDraftAtPath(item.path);
        nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined);
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [nav, reload],
  );

  const runForGroup = useCallback(
    async (group: PendingReviewAuthorGroup, action: "approve" | "discard") => {
      setBusy(true);
      try {
        for (const item of group.items) {
          if (action === "approve") await approveDraftAtPath(item.path);
          else await discardDraftAtPath(item.path);
        }
        nav.reloadModel(nav.paperPath ? { path: nav.paperPath } : undefined);
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [nav, reload],
  );

  if (!nav.paperSlug) {
    return (
      <div className={cn("p-3 text-xs text-muted-foreground", className)}>
        Open a paper to review pending changes.
      </div>
    );
  }

  if (loading && totalCount === 0) {
    return <LoadingSkeleton className={cn("p-3", className)} lines={6} />;
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Review changes
          </h2>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-100">
            {totalCount}
          </span>
        </div>
        {filterOptions.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] transition-colors",
                  filter === option.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {totalCount === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            No pending changes — ready to export.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleGroups.map((group) => (
              <AuthorGroupSection
                key={group.authorKey}
                group={group}
                open={expandedGroups.has(group.authorKey) || visibleGroups.length === 1}
                busy={busy}
                onToggle={() => toggleGroup(group.authorKey)}
                onOpen={handleOpen}
                onApprove={(item) => void runForItem(item, "approve")}
                onDiscard={(item) => void runForItem(item, "discard")}
                onApproveAll={(value) => void runForGroup(value, "approve")}
                onDiscardAll={(value) => void runForGroup(value, "discard")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
