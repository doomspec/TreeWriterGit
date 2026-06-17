import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, GitBranch, RefreshCw, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchSettings,
  formatInterval,
  runGitSyncNow,
  updateDefaultProvider,
  updateGitSyncAutoSync,
  type AgentSettings,
  type AppSettings,
  type GitSyncSettings,
} from "@/lib/settingsApi";
import { saveLastAgentProvider } from "@/lib/lastAgentProvider";
import { getUserName, setUserName } from "@/lib/userIdentity";
import { cn } from "@/lib/utils";

function SettingsSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof GitBranch;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "absolute top-0.5 block h-5 w-5 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SettingsPage({
  onBack,
  onError,
  onGitSyncChange,
}: {
  onBack: () => void;
  onError: (message: string) => void;
  onGitSyncChange?: (settings: GitSyncSettings) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [gitSync, setGitSync] = useState<GitSyncSettings | null>(null);
  const [agents, setAgents] = useState<AgentSettings | null>(null);
  const [authorName, setAuthorName] = useState(() => getUserName());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings: AppSettings = await fetchSettings();
      setGitSync(settings.gitSync);
      setAgents(settings.agents);
      onGitSyncChange?.(settings.gitSync);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onError, onGitSyncChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAutoSyncChange = async (autoSync: boolean) => {
    if (!gitSync?.enabled) return;
    setSaving("autoSync");
    try {
      const updated = await updateGitSyncAutoSync(autoSync);
      const next = { ...gitSync, ...updated };
      setGitSync(next);
      onGitSyncChange?.(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const handleProviderChange = async (defaultProvider: string) => {
    setSaving("provider");
    try {
      const updated = await updateDefaultProvider(defaultProvider);
      setAgents(updated);
      saveLastAgentProvider(defaultProvider);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const handleSyncNow = async () => {
    setSaving("sync");
    try {
      const status = await runGitSyncNow();
      if (gitSync) {
        const next = {
          ...gitSync,
          status: {
            ...gitSync.status,
            ...status,
          },
        };
        setGitSync(next);
        onGitSyncChange?.(next);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const handleAuthorSave = () => {
    setUserName(authorName.trim() || "Anonymous");
  };

  const syncStatus = gitSync?.status;
  const syncStatusLabel = syncStatus?.conflictDetected
    ? "Conflict"
    : syncStatus?.lastError
      ? "Error"
      : syncStatus?.running
        ? "Syncing"
        : syncStatus?.lastSuccessAt
          ? "OK"
          : "Idle";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-workspace">
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </Button>
          <h1 className="text-sm font-semibold">Settings</h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading settings…</p>
          ) : (
            <>
              <SettingsSection title="Git sync" icon={GitBranch}>
                <SettingRow
                  label="Automatic sync"
                  hint={
                    gitSync?.enabled
                      ? `Sync every ${formatInterval(gitSync.intervalMs)} when enabled`
                      : "Git sync is disabled by server configuration"
                  }
                >
                  <Toggle
                    checked={Boolean(gitSync?.autoSync)}
                    disabled={!gitSync?.enabled || saving === "autoSync"}
                    label="Automatic git sync"
                    onChange={(checked) => void handleAutoSyncChange(checked)}
                  />
                </SettingRow>

                <SettingRow label="Sync now" hint="Pull and push model changes immediately">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={!gitSync?.enabled || syncStatus?.running || saving === "sync"}
                    onClick={() => void handleSyncNow()}
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5", saving === "sync" && "animate-spin")}
                      aria-hidden="true"
                    />
                    Sync now
                  </Button>
                </SettingRow>

                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Status: <strong className="text-foreground">{syncStatusLabel}</strong>
                    </span>
                    {syncStatus?.lastSuccessAt ? (
                      <span>
                        Last success: {new Date(syncStatus.lastSuccessAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  {gitSync ? (
                    <p className="mt-2">
                      Commit paths: {gitSync.commitPaths.join(", ")} · Exclude:{" "}
                      {gitSync.excludePaths.join(", ")}
                    </p>
                  ) : null}
                  {syncStatus?.lastError ? (
                    <p className="mt-2 text-destructive">{syncStatus.lastError}</p>
                  ) : null}
                </div>
              </SettingsSection>

              <SettingsSection title="AI harness" icon={Bot}>
                <SettingRow
                  label="Default provider"
                  hint="Used for AI dispatch in outline and draft panes"
                >
                  <select
                    className="h-8 min-w-[10rem] rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={agents?.defaultProvider ?? ""}
                    disabled={!agents || saving === "provider"}
                    onChange={(event) => void handleProviderChange(event.target.value)}
                  >
                    {(agents?.aiProviders ?? []).map((provider) => (
                      <option key={provider.name} value={provider.name}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </SettingRow>

                {agents?.defaultProvider ? (
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {(() => {
                      const selected = agents.aiProviders.find(
                        (provider) => provider.name === agents.defaultProvider,
                      );
                      if (!selected) return null;
                      return (
                        <>
                          Command: <code className="text-foreground">{selected.command}</code>
                          {selected.writesFiles ? " · writes files directly" : " · preview only"}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </SettingsSection>

              <SettingsSection title="Profile" icon={User}>
                <SettingRow
                  label="Author name"
                  hint="Shown on comments and co-editing presence"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={authorName}
                      className="h-8 w-40 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onChange={(event) => setAuthorName(event.target.value)}
                      onBlur={handleAuthorSave}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleAuthorSave();
                      }}
                    />
                  </div>
                </SettingRow>
              </SettingsSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
