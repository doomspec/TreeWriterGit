import { request } from "@/lib/apiClient";

export type GitSyncStatus = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastOutput?: string | null;
  conflictDetected?: boolean;
  pendingStashRestore?: boolean;
  viewChangesBlocked?: boolean;
};

export type GitSyncSettings = {
  enabled: boolean;
  autoSync: boolean;
  intervalMs: number;
  commitPaths: string[];
  excludePaths: string[];
  status: GitSyncStatus;
};

export type AiProviderInfo = {
  name: string;
  command: string;
  writesFiles: boolean;
};

export type AgentSettings = {
  aiProviders: AiProviderInfo[];
  defaultProvider: string;
};

export type AutoExportStatus = {
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastPaperSlug: string | null;
  lastMessage: string | null;
};

export type ExportSettings = {
  autoExport: boolean;
  includeDrafts: boolean;
  pushOverleaf: boolean;
  debounceMs: number;
  status: AutoExportStatus;
};

export type AppSettings = {
  gitSync: GitSyncSettings;
  export: ExportSettings;
  agents: AgentSettings;
};

export function fetchSettings(): Promise<AppSettings> {
  return request<AppSettings>("/api/settings");
}

export function updateGitSyncSettings(patch: {
  autoSync?: boolean;
  intervalMs?: number;
}): Promise<Omit<GitSyncSettings, "status">> {
  return request("/api/settings/git-sync", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** @deprecated Use updateGitSyncSettings */
export function updateGitSyncAutoSync(autoSync: boolean): Promise<Omit<GitSyncSettings, "status">> {
  return updateGitSyncSettings({ autoSync });
}

export function updateExportSettings(patch: {
  autoExport?: boolean;
  includeDrafts?: boolean;
  pushOverleaf?: boolean;
  debounceMs?: number;
}): Promise<Omit<ExportSettings, "status"> & { status: AutoExportStatus }> {
  return request("/api/settings/export", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function updateDefaultProvider(defaultProvider: string): Promise<AgentSettings> {
  return request("/api/settings/agent", {
    method: "PATCH",
    body: JSON.stringify({ defaultProvider }),
  });
}

export function fetchGitSyncStatus(): Promise<GitSyncStatus & { autoSync?: boolean; intervalMs?: number }> {
  return request("/api/git-sync/status");
}

export function runGitSyncNow(): Promise<GitSyncStatus & { autoSync?: boolean; intervalMs?: number }> {
  return request("/api/git-sync/run", { method: "POST" });
}

export type GitSyncResolveHarness = {
  command: string;
  prompt: string;
  providerName: string;
  sessionId: string;
};

export function fetchGitSyncResolveHarness(provider?: string): Promise<GitSyncResolveHarness> {
  return request("/api/git-sync/resolve-harness", {
    method: "POST",
    body: JSON.stringify(provider ? { provider } : {}),
  });
}

export const SYNC_INTERVAL_OPTIONS = [
  { ms: 60_000, label: "1 minute" },
  { ms: 120_000, label: "2 minutes" },
  { ms: 300_000, label: "5 minutes" },
  { ms: 600_000, label: "10 minutes" },
  { ms: 3_600_000, label: "1 hour" },
  { ms: 86_400_000, label: "1 day" },
] as const;

/** @deprecated Use SYNC_INTERVAL_OPTIONS */
export const EXPORT_DEBOUNCE_OPTIONS = SYNC_INTERVAL_OPTIONS;

export function formatExportDebounceLabel(ms: number): string {
  const preset = EXPORT_DEBOUNCE_OPTIONS.find((option) => option.ms === ms);
  if (preset) return preset.label;
  if (ms < 60_000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3_600_000) {
    const minutes = Math.round(ms / 60_000);
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  if (ms < 86_400_000) {
    const hours = Math.round(ms / 3_600_000);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return ms === 86_400_000 ? "1 day" : `${Math.round(ms / 86_400_000)} days`;
}

export function formatInterval(ms: number): string {
  return formatExportDebounceLabel(ms);
}
