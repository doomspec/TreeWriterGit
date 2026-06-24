import { Pin, PinOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatGitSyncError, gitSyncHasError, type GitSyncState } from "@/lib/gitSync";

export function SidebarPanelHeader({
  gitSync,
  gitStatusLabel,
  onGitClick,
  connectionState,
  pinned,
  onTogglePin,
}: {
  gitSync: GitSyncState | null;
  gitStatusLabel: string;
  onGitClick: () => void;
  connectionState: string;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  return (
    <div className="sidebar-panel-header sticky top-0 z-[55] flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-[hsl(var(--sidebar-bg))] px-3 py-2">
      <button
        type="button"
        className={cn(
          gitSyncBadgeClass(gitSync),
          "max-w-full cursor-pointer truncate transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
        )}
        title={
          gitSync && gitSyncHasError(gitSync)
            ? formatGitSyncError(gitSync)
            : gitSync?.enabled
              ? gitSync.autoSync === false
                ? "Git sync — auto sync off (click to sync now)"
                : `Git sync (auto every ${Math.round((gitSync.intervalMs ?? 120_000) / 1000)}s) — click to sync now`
              : "Git sync disabled"
        }
        disabled={!gitSync?.enabled || gitSync?.running}
        onClick={onGitClick}
      >
        git {gitStatusLabel}
      </button>
      <span className="ui-badge-neutral truncate" title={`Terminal ${connectionState}`}>
        terminal {connectionState}
      </span>
      {onTogglePin ? (
        <Button
          type="button"
          variant={pinned ? "default" : "ghost"}
          size="icon"
          className="ml-auto h-7 w-7 shrink-0"
          title={pinned ? "Unpin sidebar (show on hover)" : "Pin sidebar open"}
          aria-label={pinned ? "Unpin sidebar panel" : "Pin sidebar panel open"}
          aria-pressed={pinned}
          onClick={onTogglePin}
        >
          {pinned ? (
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

export function gitSyncBadgeClass(gitSync: GitSyncState | null): string {
  if (gitSync?.conflictDetected) return "ui-badge-destructive";
  if (gitSync?.lastError) return "ui-badge-warning";
  if (gitSync?.running) return "ui-badge-warning";
  if (gitSync?.enabled) return "ui-badge-success";
  return "ui-badge-neutral";
}
