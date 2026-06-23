import { useCallback, useEffect, useState } from "react";

import { formatGitSyncError, gitSyncHasError, type GitSyncState } from "@/lib/gitSync";
import type { GitSyncSettings } from "@/lib/settingsApi";
import { fetchGitSyncStatus, runGitSyncNow } from "@/lib/settingsApi";

type UseGitSyncStateOptions = {
  onError?: (message: string) => void;
};

export function useGitSyncState(options: UseGitSyncStateOptions = {}) {
  const { onError } = options;
  const [gitSync, setGitSync] = useState<GitSyncState | null>(null);

  const loadGitSyncStatus = useCallback(async () => {
    try {
      setGitSync(await fetchGitSyncStatus());
    } catch {
      // non-fatal
    }
  }, []);

  const handleGitSyncSettingsChange = useCallback((settings: GitSyncSettings) => {
    setGitSync({
      ...settings.status,
      autoSync: settings.autoSync,
      intervalMs: settings.intervalMs,
    });
  }, []);

  const runGitSync = useCallback(async () => {
    try {
      const state = await runGitSyncNow();
      setGitSync(state);
      if (gitSyncHasError(state)) {
        onError?.(formatGitSyncError(state));
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }, [onError]);

  const handleGitBadgeClick = useCallback(() => {
    if (gitSync && gitSyncHasError(gitSync)) {
      onError?.(formatGitSyncError(gitSync));
      return;
    }
    void runGitSync();
  }, [gitSync, onError, runGitSync]);

  const gitStatusLabel = gitSync?.conflictDetected
    ? "conflict"
    : gitSync?.lastError
      ? "error"
      : gitSync?.running
        ? "syncing"
        : gitSync?.enabled
          ? "ok"
          : "off";

  useEffect(() => {
    loadGitSyncStatus().catch(() => {});
  }, [loadGitSyncStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => loadGitSyncStatus().catch(() => {}), 30_000);
    return () => window.clearInterval(timer);
  }, [loadGitSyncStatus]);

  return {
    gitSync,
    loadGitSyncStatus,
    runGitSync,
    handleGitSyncSettingsChange,
    handleGitBadgeClick,
    gitStatusLabel,
  };
}
