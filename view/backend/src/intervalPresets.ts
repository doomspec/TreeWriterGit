/** Shared timing presets for git sync interval and auto-export debounce. */
export const SYNC_INTERVAL_PRESETS_MS = [
  60_000,
  120_000,
  300_000,
  600_000,
  3_600_000,
  86_400_000,
] as const;

export type SyncIntervalPresetMs = (typeof SYNC_INTERVAL_PRESETS_MS)[number];

export const DEFAULT_GIT_SYNC_INTERVAL_MS: SyncIntervalPresetMs = 120_000;
export const DEFAULT_EXPORT_DEBOUNCE_MS: SyncIntervalPresetMs = 60_000;

export function isAllowedSyncIntervalMs(ms: number): ms is SyncIntervalPresetMs {
  return (SYNC_INTERVAL_PRESETS_MS as readonly number[]).includes(ms);
}

export function normalizeGitSyncIntervalMs(ms: number): SyncIntervalPresetMs {
  if (isAllowedSyncIntervalMs(ms)) return ms;
  return DEFAULT_GIT_SYNC_INTERVAL_MS;
}

export function normalizeExportDebounceMs(ms: number): SyncIntervalPresetMs {
  if (isAllowedSyncIntervalMs(ms)) return ms;
  return DEFAULT_EXPORT_DEBOUNCE_MS;
}

export function formatSyncIntervalLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3_600_000) {
    const minutes = ms / 60_000;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  if (ms < 86_400_000) {
    const hours = ms / 3_600_000;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return ms === 86_400_000 ? "1 day" : `${Math.round(ms / 86_400_000)} days`;
}
