import type { GitSyncStatus } from "@/lib/settingsApi";

export type GitSyncState = GitSyncStatus & {
  autoSync?: boolean;
  intervalMs?: number;
};

export type GitSyncStatusLike = Pick<
  GitSyncState,
  "lastError" | "conflictDetected" | "viewChangesBlocked"
>;

export function formatGitSyncError(state: GitSyncState): string {
  const parts: string[] = [];
  if (state.conflictDetected) {
    parts.push("Git sync conflict detected.");
  }
  if (state.lastError?.trim()) {
    parts.push(state.lastError.trim());
  }
  if (state.lastOutput?.trim()) {
    parts.push(`---\n${state.lastOutput.trim()}`);
  }
  return parts.join("\n\n") || "Git sync failed.";
}

export function gitSyncHasError(state: GitSyncState | null): boolean {
  return Boolean(state && (state.lastError || state.conflictDetected));
}

export function isViewSyncPaused(state: GitSyncStatusLike | null | undefined): boolean {
  if (!state) return false;
  if (state.viewChangesBlocked) return true;
  const message = state.lastError ?? "";
  return (
    message.includes("local view/ changes prevented rebase") ||
    message.includes("Commit view/ or sync manually")
  );
}
