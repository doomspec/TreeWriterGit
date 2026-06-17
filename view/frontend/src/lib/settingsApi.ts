const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type GitSyncStatus = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastOutput?: string | null;
  conflictDetected?: boolean;
  pendingStashRestore?: boolean;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Invalid JSON from API (${response.status})`);
    }
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

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

export function runGitSyncNow(): Promise<GitSyncStatus & { autoSync?: boolean; intervalMs?: number }> {
  return request("/api/git-sync/run", { method: "POST" });
}

export function formatInterval(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} seconds`;
  const minutes = Math.round(ms / 60_000);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
