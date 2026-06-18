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

export type AppSettings = {
  gitSync: GitSyncSettings;
  agents: AgentSettings;
};

export function fetchSettings(): Promise<AppSettings> {
  return request<AppSettings>("/api/settings");
}

export function updateGitSyncAutoSync(autoSync: boolean): Promise<Omit<GitSyncSettings, "status">> {
  return request("/api/settings/git-sync", {
    method: "PATCH",
    body: JSON.stringify({ autoSync }),
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

export function formatInterval(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} seconds`;
  const minutes = Math.round(ms / 60_000);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
