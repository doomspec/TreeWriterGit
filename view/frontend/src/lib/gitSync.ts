export type GitSyncStatusLike = {
  lastError?: string | null;
  conflictDetected?: boolean;
  viewChangesBlocked?: boolean;
};

export function isViewSyncPaused(state: GitSyncStatusLike | null | undefined): boolean {
  if (!state) return false;
  if (state.viewChangesBlocked) return true;
  const message = state.lastError ?? "";
  return (
    message.includes("local view/ changes prevented rebase") ||
    message.includes("Commit view/ or sync manually")
  );
}
