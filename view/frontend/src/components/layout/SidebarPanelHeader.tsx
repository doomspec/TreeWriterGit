import { cn } from "@/lib/utils";
import { formatGitSyncError, gitSyncHasError, type GitSyncState } from "@/lib/gitSync";

/** Git and terminal status — pinned to the bottom of the sidebar panel. */
export function SidebarPanelFooter({
  gitSync,
  gitStatusLabel,
  onGitClick,
  connectionState,
}: {
  gitSync: GitSyncState | null;
  gitStatusLabel: string;
  onGitClick: () => void;
  connectionState: string;
}) {
  return (
    <div className="sidebar-panel-header shrink-0 border-t border-border">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <button
          type="button"
          className={cn(
            gitSyncBadgeClass(gitSync),
            "shrink-0 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
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
        <span
          className="ui-badge-neutral min-w-0 flex-1 truncate"
          title={`Terminal ${connectionState.replace("_", " ")}`}
        >
          terminal {connectionState.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}

/** @deprecated Use SidebarPanelFooter */
export const SidebarPanelHeader = SidebarPanelFooter;

export function gitSyncBadgeClass(gitSync: GitSyncState | null): string {
  if (gitSync?.conflictDetected) return "ui-badge-destructive";
  if (gitSync?.lastError) return "ui-badge-warning";
  if (gitSync?.running) return "ui-badge-warning";
  if (gitSync?.enabled) return "ui-badge-success";
  return "ui-badge-neutral";
}
