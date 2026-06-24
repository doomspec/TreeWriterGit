import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Download, GitBranch, Monitor, RefreshCw, RotateCcw, User } from "lucide-react";

import { KeyboardShortcutsSection } from "@/components/settings/KeyboardShortcutsSection";
import { Button } from "@/components/ui/button";
import { ThemePreferenceSelect } from "@/components/ui/ThemeToggle";
import {
  READING_FONT_FAMILIES,
  READING_FONT_SIZE_MAX,
  READING_FONT_SIZE_MIN,
  READING_FONT_SIZE_STEP,
  formatReadingFontSizeScale,
  type ReadingFontFamilyId,
} from "@/lib/readingTypography";
import { useReadingTypography } from "@/lib/ReadingTypographyProvider";
import type { ThemePreference } from "@/lib/themePreferences";
import {
  fetchSettings,
  formatExportDebounceLabel,
  formatInterval,
  runGitSyncNow,
  updateDefaultProvider,
  updateExportSettings,
  updateGitSyncSettings,
  SYNC_INTERVAL_OPTIONS,
  EXPORT_DEBOUNCE_OPTIONS,
  type AgentSettings,
  type AppSettings,
  type ExportSettings,
  type GitSyncSettings,
} from "@/lib/settingsApi";
import { saveLastAgentProvider } from "@/lib/lastAgentProvider";
import { getGitHubHandle, getUserName, setGitHubHandle, setUserName } from "@/lib/userIdentity";
import { resetAppState } from "@/lib/resetAppState";
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
  viewSyncPaused = false,
  onResolveViewSync,
  themePreference = "system",
  onThemePreferenceChange,
}: {
  onBack: () => void;
  onError: (message: string) => void;
  onGitSyncChange?: (settings: GitSyncSettings) => void;
  viewSyncPaused?: boolean;
  onResolveViewSync?: () => void;
  themePreference?: ThemePreference;
  onThemePreferenceChange?: (preference: ThemePreference) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [gitSync, setGitSync] = useState<GitSyncSettings | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings | null>(null);
  const [agents, setAgents] = useState<AgentSettings | null>(null);
  const [authorName, setAuthorName] = useState(() => getUserName());
  const [githubHandle, setGithubHandleState] = useState(() => getGitHubHandle());
  const { fontFamily, fontSizeScale, setFontFamily, setFontSizeScale } = useReadingTypography();
  const onGitSyncChangeRef = useRef(onGitSyncChange);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    onGitSyncChangeRef.current = onGitSyncChange;
  }, [onGitSyncChange]);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const settings: AppSettings = await fetchSettings();
      setGitSync(settings.gitSync);
      setExportSettings(settings.export);
      setAgents(settings.agents);
      onGitSyncChangeRef.current?.(settings.gitSync);
      hasLoadedRef.current = true;
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAutoSyncChange = async (autoSync: boolean) => {
    if (!gitSync?.enabled) return;
    setSaving("autoSync");
    try {
      const updated = await updateGitSyncSettings({ autoSync });
      const next = { ...gitSync, ...updated };
      setGitSync(next);
      onGitSyncChange?.(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const patchGitSyncSettings = async (
    patch: { autoSync?: boolean; intervalMs?: number },
    savingKey: string,
  ) => {
    if (!gitSync?.enabled) return;
    setSaving(savingKey);
    try {
      const updated = await updateGitSyncSettings(patch);
      const next = { ...gitSync, ...updated };
      setGitSync(next);
      onGitSyncChange?.(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const patchExportSettings = async (
    patch: {
      autoExport?: boolean;
      includeDrafts?: boolean;
      pushOverleaf?: boolean;
      debounceMs?: number;
    },
    savingKey: string,
  ) => {
    if (!exportSettings) return;
    setSaving(savingKey);
    try {
      const updated = await updateExportSettings(patch);
      const next = { ...exportSettings, ...updated };
      setExportSettings(next);
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

  const handleGitHubHandleSave = () => {
    setGitHubHandle(githubHandle);
    setGithubHandleState(getGitHubHandle());
  };

  const handleResetAppState = async () => {
    const confirmed = window.confirm(
      "Reset TreeWriter app state?\n\nThis clears saved layout, editor scroll positions, terminal session, and server memory caches. Your manuscript files are not deleted.",
    );
    if (!confirmed) return;
    setSaving("reset");
    try {
      await resetAppState(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setSaving(null);
    }
  };

  const syncStatus = gitSync?.status;
  const exportStatus = exportSettings?.status;
  const syncStatusLabel = syncStatus?.conflictDetected
    ? "Conflict"
    : syncStatus?.lastError
      ? "Error"
      : syncStatus?.running
        ? "Syncing"
        : syncStatus?.lastSuccessAt
          ? "OK"
          : "Idle";

  const exportStatusLabel = exportStatus?.running
    ? "Exporting"
    : exportStatus?.lastError
      ? "Error"
      : exportStatus?.lastSuccessAt
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
              <SettingsSection title="Appearance" icon={Monitor}>
                <SettingRow
                  label="Color theme"
                  hint="Light, dark, or match your system preference"
                >
                  <ThemePreferenceSelect
                    preference={themePreference}
                    onChange={(next) => onThemePreferenceChange?.(next)}
                  />
                </SettingRow>
                <SettingRow
                  label="Rendered font"
                  hint="Font family for outline, draft, and preview panes"
                >
                  <select
                    className="h-8 min-w-[10rem] rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={fontFamily}
                    onChange={(event) => setFontFamily(event.target.value as ReadingFontFamilyId)}
                  >
                    {(Object.keys(READING_FONT_FAMILIES) as ReadingFontFamilyId[]).map((id) => (
                      <option key={id} value={id}>
                        {READING_FONT_FAMILIES[id].label}
                      </option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow
                  label="Rendered font size"
                  hint="Global reading size; per-pane zoom still applies on top"
                >
                  <div className="flex min-w-[12rem] items-center gap-2">
                    <input
                      type="range"
                      min={READING_FONT_SIZE_MIN}
                      max={READING_FONT_SIZE_MAX}
                      step={READING_FONT_SIZE_STEP}
                      value={fontSizeScale}
                      aria-label="Rendered font size"
                      className="h-2 w-full accent-primary"
                      onChange={(event) => setFontSizeScale(Number(event.target.value))}
                    />
                    <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {formatReadingFontSizeScale(fontSizeScale)}
                    </span>
                  </div>
                </SettingRow>
              </SettingsSection>

              <SettingsSection title="Git sync" icon={GitBranch}>
                <SettingRow
                  label="Automatic sync"
                  hint="Pull and push model changes on a schedule"
                >
                  <Toggle
                    checked={Boolean(gitSync?.autoSync)}
                    disabled={!gitSync?.enabled || saving === "autoSync"}
                    label="Automatic git sync"
                    onChange={(checked) => void handleAutoSyncChange(checked)}
                  />
                </SettingRow>

                <SettingRow
                  label="Sync interval"
                  hint={
                    gitSync?.autoSync
                      ? `Runs every ${formatInterval(gitSync.intervalMs)}`
                      : "Enable automatic sync to choose an interval"
                  }
                >
                  <select
                    className="h-8 min-w-[10rem] rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={gitSync?.intervalMs ?? 120_000}
                    disabled={
                      !gitSync?.enabled || !gitSync.autoSync || saving === "intervalMs"
                    }
                    aria-label="Git sync interval"
                    onChange={(event) =>
                      void patchGitSyncSettings(
                        { intervalMs: Number(event.target.value) },
                        "intervalMs",
                      )
                    }
                  >
                    {SYNC_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.ms} value={option.ms}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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

                {viewSyncPaused && onResolveViewSync ? (
                  <SettingRow
                    label="Resolve view/ pause"
                    hint="Dispatch the default AI harness to commit view/ changes, rebase, and push"
                  >
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={!gitSync?.enabled || syncStatus?.running || saving === "harness"}
                      onClick={() => {
                        setSaving("harness");
                        try {
                          onResolveViewSync();
                        } finally {
                          window.setTimeout(() => setSaving(null), 600);
                        }
                      }}
                    >
                      <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      Resolve with harness
                    </Button>
                  </SettingRow>
                ) : null}

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

              <SettingsSection title="Export" icon={Download}>
                <SettingRow
                  label="Automatic export"
                  hint="Regenerate LaTeX sections and push to Overleaf after you stop editing"
                >
                  <Toggle
                    checked={Boolean(exportSettings?.autoExport)}
                    disabled={!exportSettings || saving === "autoExport"}
                    label="Automatic export"
                    onChange={(checked) => void patchExportSettings({ autoExport: checked }, "autoExport")}
                  />
                </SettingRow>

                <SettingRow
                  label="Auto-export delay"
                  hint={
                    exportSettings?.autoExport
                      ? `Export runs ${formatExportDebounceLabel(exportSettings.debounceMs)} after the last edit`
                      : "Enable automatic export to choose a delay"
                  }
                >
                  <select
                    className="h-8 min-w-[10rem] rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={exportSettings?.debounceMs ?? 60_000}
                    disabled={
                      !exportSettings ||
                      !exportSettings.autoExport ||
                      saving === "debounceMs"
                    }
                    aria-label="Auto-export delay"
                    onChange={(event) =>
                      void patchExportSettings(
                        { debounceMs: Number(event.target.value) },
                        "debounceMs",
                      )
                    }
                  >
                    {EXPORT_DEBOUNCE_OPTIONS.map((option) => (
                      <option key={option.ms} value={option.ms}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </SettingRow>

                <SettingRow
                  label="Include non-approved drafts"
                  hint="Export outlines and drafted units, not just approved content"
                >
                  <Toggle
                    checked={Boolean(exportSettings?.includeDrafts)}
                    disabled={!exportSettings || saving === "includeDrafts"}
                    label="Include non-approved drafts in auto-export"
                    onChange={(checked) =>
                      void patchExportSettings({ includeDrafts: checked }, "includeDrafts")
                    }
                  />
                </SettingRow>

                <SettingRow
                  label="Push to Overleaf"
                  hint="When a paper is connected, auto-export pushes main.tex, sections/, and references.bib"
                >
                  <Toggle
                    checked={Boolean(exportSettings?.pushOverleaf)}
                    disabled={!exportSettings || saving === "pushOverleaf"}
                    label="Push to Overleaf on auto-export"
                    onChange={(checked) =>
                      void patchExportSettings({ pushOverleaf: checked }, "pushOverleaf")
                    }
                  />
                </SettingRow>

                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Status: <strong className="text-foreground">{exportStatusLabel}</strong>
                    </span>
                    {exportStatus?.lastPaperSlug ? (
                      <span>Paper: {exportStatus.lastPaperSlug}</span>
                    ) : null}
                    {exportStatus?.lastSuccessAt ? (
                      <span>
                        Last success: {new Date(exportStatus.lastSuccessAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  {exportStatus?.lastMessage ? (
                    <p className="mt-2 text-foreground">{exportStatus.lastMessage}</p>
                  ) : null}
                  {exportStatus?.lastError ? (
                    <p className="mt-2 text-destructive">{exportStatus.lastError}</p>
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
                <SettingRow
                  label="GitHub handle"
                  hint="Recorded on draft edits and approvals (without @)"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">@</span>
                    <input
                      type="text"
                      value={githubHandle}
                      className="h-8 w-40 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="octocat"
                      onChange={(event) => setGithubHandleState(event.target.value)}
                      onBlur={handleGitHubHandleSave}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleGitHubHandleSave();
                      }}
                    />
                  </div>
                </SettingRow>
              </SettingsSection>

              <SettingsSection title="Troubleshooting" icon={RotateCcw}>
                <SettingRow
                  label="Reset app state"
                  hint="Clears browser localStorage and server memory caches, then reloads. Use if the UI is sluggish or stuck."
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={saving === "reset"}
                    onClick={() => void handleResetAppState()}
                  >
                    <RotateCcw
                      className={cn("h-3.5 w-3.5", saving === "reset" && "animate-spin")}
                      aria-hidden="true"
                    />
                    Reset & reload
                  </Button>
                </SettingRow>
              </SettingsSection>

              <KeyboardShortcutsSection />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
