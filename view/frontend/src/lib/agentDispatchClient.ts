import { fanOutDispatch, fetchContextFiles } from "@/modelApi";
import { request } from "@/lib/apiClient";
import { resolveAgentProvider, saveLastAgentProvider } from "@/lib/lastAgentProvider";
import { fetchGitSyncResolveHarness } from "@/lib/settingsApi";
import { getGitHubHandle } from "@/lib/userIdentity";
import type { PersistedDispatchJob } from "@/lib/dispatchProgressStore";

export type AgentDispatchAction =
  | "draft"
  | "revise"
  | "expand"
  | "cite-check"
  | "custom"
  | "refresh-index"
  | "sync-outline"
  | "summarize-outline"
  | "generate-figure";

export type DispatchProgressState = {
  phase: "idle" | "running" | "done" | "error";
  action: AgentDispatchAction;
  total: number;
  completed: number;
  currentUnit?: string;
  logs: string[];
};

export type DispatchJobPersistence = {
  jobKey: string;
  scope: "unit" | "section";
  targetPath: string;
  pane?: "outline" | "draft";
  extrasRef: { current: Partial<PersistedDispatchJob> };
  reportProgress: (state: DispatchProgressState) => void;
};

function reportDispatchProgress(
  state: DispatchProgressState,
  onProgress: (state: DispatchProgressState) => void,
  persistence?: DispatchJobPersistence,
): void {
  if (persistence) {
    persistence.reportProgress(state);
    return;
  }
  onProgress(state);
}

function shortUnitLabel(unitPath: string): string {
  const parts = unitPath.split("/");
  return parts[parts.length - 1] || unitPath;
}

function unitPathFromOutputPath(outputPath: string): string {
  return outputPath.replace(/\/(?:draft|outline)\.md$/, "");
}

export interface AgentPreviewResult {
  prompt: string;
  command: string;
  outputPath: string;
  sessionId?: string;
}

interface ProviderConfig {
  aiProviders: Array<{ name: string; command: string; writesFiles: boolean }>;
  defaultProvider: string;
}

let providersCache: ProviderConfig | null = null;

export async function loadAgentProviderConfig(): Promise<ProviderConfig> {
  if (providersCache) return providersCache;
  providersCache = await request<ProviderConfig>("/api/agent/providers");
  return providersCache;
}

export async function getDefaultAgentProvider(): Promise<string> {
  const config = await loadAgentProviderConfig();
  const names = config.aiProviders.map((p) => p.name);
  return resolveAgentProvider(config.defaultProvider, names);
}

export function rememberAgentProvider(name: string): void {
  saveLastAgentProvider(name);
}

export async function defaultContextPaths(
  unitPath: string,
  action: AgentDispatchAction,
): Promise<string[]> {
  const { files } = await fetchContextFiles(unitPath, action);
  return files.filter((f) => f.defaultIncluded).map((f) => f.path);
}

export async function previewAgentDispatch(options: {
  unitPath: string;
  action: AgentDispatchAction;
  provider?: string;
  customPrompt?: string;
  contextPaths?: string[];
  sessionId?: string;
}): Promise<AgentPreviewResult> {
  const provider = options.provider ?? (await getDefaultAgentProvider());
  const contextPaths =
    options.contextPaths ?? (await defaultContextPaths(options.unitPath, options.action));
  const sessionId =
    options.sessionId ?? `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return request<AgentPreviewResult>("/api/agent/preview", {
    method: "POST",
    body: JSON.stringify({
      unitPath: options.unitPath,
      action: options.action,
      provider,
      customPrompt: options.customPrompt,
      sessionId,
      contextPaths,
    }),
  });
}

async function recordAgentSession(options: {
  unitPath: string;
  provider: string;
  action: AgentDispatchAction;
  command: string;
}): Promise<string | null> {
  try {
    const data = await request<{ path?: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        unitPath: options.unitPath,
        provider: options.provider,
        action: options.action,
        command: options.command,
        status: "dispatched",
      }),
    });
    return data.path?.split("/").pop() ?? null;
  } catch {
    return null;
  }
}

export type AgentSessionFile = {
  filename: string;
  at: string;
  provider: string;
  action: string;
  command: string;
  status: "dispatched" | "complete" | "skipped";
  notes?: string;
  body: string;
  wikiPath?: string;
};

export async function fetchUnitSessions(unitPath: string): Promise<AgentSessionFile[]> {
  if (!unitPath) return [];
  try {
    const data = await request<{ sessions: AgentSessionFile[] }>(
      `/api/sessions?unitPath=${encodeURIComponent(unitPath)}`,
    );
    return data.sessions;
  } catch {
    return [];
  }
}

export async function createUnitSession(options: {
  unitPath: string;
  provider: string;
  action: AgentDispatchAction;
  command: string;
}): Promise<string | null> {
  return recordAgentSession(options);
}

export async function patchUnitSession(options: {
  unitPath: string;
  filename: string;
  status: AgentSessionFile["status"];
}): Promise<void> {
  try {
    await request("/api/sessions", {
      method: "PATCH",
      body: JSON.stringify(options),
    });
  } catch {
    // non-fatal
  }
}

export async function runAgentDispatchSilent(options: {
  unitPath: string;
  action: AgentDispatchAction;
  provider?: string;
  customPrompt?: string;
  contextPaths?: string[];
}): Promise<{ outputPath: string; sessionId: string }> {
  const provider = options.provider ?? (await getDefaultAgentProvider());
  const contextPaths =
    options.contextPaths ?? (await defaultContextPaths(options.unitPath, options.action));
  const result = await request<{ outputPath: string; sessionId: string }>("/api/agent/run", {
    method: "POST",
    body: JSON.stringify({
      unitPath: options.unitPath,
      action: options.action,
      provider,
      customPrompt: options.customPrompt,
      contextPaths,
      triggeredBy: getGitHubHandle() || undefined,
    }),
  });
  rememberAgentProvider(provider);
  return result;
}

export async function runAgentDispatch(options: {
  unitPath: string;
  action: AgentDispatchAction;
  provider?: string;
  customPrompt?: string;
  onSendToTerminal: (command: string) => void;
}): Promise<AgentPreviewResult> {
  const provider = options.provider ?? (await getDefaultAgentProvider());
  const preview = await previewAgentDispatch({
    unitPath: options.unitPath,
    action: options.action,
    provider,
    customPrompt: options.customPrompt,
  });
  rememberAgentProvider(provider);
  options.onSendToTerminal(`${preview.command}\n`);
  await recordAgentSession({
    unitPath: options.unitPath,
    provider,
    action: options.action,
    command: preview.command,
  });
  return preview;
}

export async function resolveViewSyncWithHarness(options: {
  provider?: string;
  onSendToTerminal: (command: string) => void;
}): Promise<{ providerName: string; sessionId: string }> {
  const preview = await fetchGitSyncResolveHarness(options.provider);
  rememberAgentProvider(preview.providerName);
  options.onSendToTerminal(`${preview.command}\n`);
  return { providerName: preview.providerName, sessionId: preview.sessionId };
}

export function dispatchActionForSectionPane(focusedPane: "outline" | "draft"): AgentDispatchAction {
  return focusedPane === "outline" ? "summarize-outline" : "sync-outline";
}

export async function runAgentDispatchWithProgress(
  options: {
    unitPath: string;
    action: AgentDispatchAction;
    provider?: string;
    customPrompt?: string;
    contextPaths?: string[];
  },
  onProgress: (state: DispatchProgressState) => void,
  persistence?: DispatchJobPersistence,
): Promise<{ outputPath: string; sessionId: string }> {
  const label = dispatchActionLabel(options.action);
  const short = shortUnitLabel(options.unitPath);
  const report = (state: DispatchProgressState) =>
    reportDispatchProgress(state, onProgress, persistence);

  if (persistence) {
    persistence.extrasRef.current = {
      ...persistence.extrasRef.current,
      provider: options.provider ?? persistence.extrasRef.current.provider,
      customPrompt: options.customPrompt ?? persistence.extrasRef.current.customPrompt,
    };
  }

  report({
    phase: "running",
    action: options.action,
    total: 1,
    completed: 0,
    currentUnit: options.unitPath,
    logs: [`${label} · ${short}`, "Running agent…"],
  });
  try {
    const result = await runAgentDispatchSilent(options);
    report({
      phase: "done",
      action: options.action,
      total: 1,
      completed: 1,
      currentUnit: options.unitPath,
      logs: [`${label} · ${short}`, "Complete"],
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report({
      phase: "error",
      action: options.action,
      total: 1,
      completed: 0,
      currentUnit: options.unitPath,
      logs: [`${label} · ${short}`, `Failed: ${message}`],
    });
    throw error;
  }
}

export async function runFanOutDispatchWithProgress(
  options: {
    sectionPath: string;
    action: AgentDispatchAction;
    provider?: string;
    customPrompt?: string;
    resumeFrom?: {
      unitPaths: string[];
      completed: number;
      logs: string[];
    };
  },
  onProgress: (state: DispatchProgressState) => void,
  persistence?: DispatchJobPersistence,
): Promise<number> {
  const provider = options.provider ?? (await getDefaultAgentProvider());
  const report = (state: DispatchProgressState) =>
    reportDispatchProgress(state, onProgress, persistence);

  if (persistence) {
    persistence.extrasRef.current = {
      ...persistence.extrasRef.current,
      provider,
      customPrompt: options.customPrompt ?? persistence.extrasRef.current.customPrompt,
    };
  }

  let unitPaths: string[];
  let logs: string[];
  let completed: number;

  if (options.resumeFrom) {
    unitPaths = options.resumeFrom.unitPaths;
    logs = [...options.resumeFrom.logs];
    completed = options.resumeFrom.completed;
    if (persistence) {
      persistence.extrasRef.current.unitPaths = unitPaths;
    }
    report({
      phase: "running",
      action: options.action,
      total: unitPaths.length,
      completed,
      currentUnit: unitPaths[completed] ?? unitPaths[unitPaths.length - 1],
      logs,
    });
  } else {
    report({
      phase: "running",
      action: options.action,
      total: 0,
      completed: 0,
      logs: ["Loading units…"],
    });

    const { units } = await fanOutDispatch({
      sectionPath: options.sectionPath,
      action: options.action,
      provider,
      customPrompt: options.customPrompt,
    });

    if (units.length === 0) {
      report({
        phase: "done",
        action: options.action,
        total: 0,
        completed: 0,
        logs: ["No units found"],
      });
      return 0;
    }

    unitPaths = units.map((unit) => unitPathFromOutputPath(unit.outputPath));
    logs = [`${dispatchActionLabel(options.action)} · ${unitPaths.length} units`];
    completed = 0;
    if (persistence) {
      persistence.extrasRef.current.unitPaths = unitPaths;
    }
    report({
      phase: "running",
      action: options.action,
      total: unitPaths.length,
      completed: 0,
      currentUnit: unitPaths[0],
      logs: [...logs],
    });
  }

  for (let index = completed; index < unitPaths.length; index += 1) {
    const unitPath = unitPaths[index];
    logs.push(`▸ ${shortUnitLabel(unitPath)}…`);
    report({
      phase: "running",
      action: options.action,
      total: unitPaths.length,
      completed,
      currentUnit: unitPath,
      logs: [...logs],
    });
    try {
      await runAgentDispatchSilent({
        unitPath,
        action: options.action,
        provider,
        customPrompt: options.customPrompt,
      });
      completed += 1;
      logs[logs.length - 1] = `✓ ${shortUnitLabel(unitPath)}`;
      report({
        phase: completed >= unitPaths.length ? "done" : "running",
        action: options.action,
        total: unitPaths.length,
        completed,
        currentUnit: unitPath,
        logs: [...logs],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs[logs.length - 1] = `✗ ${shortUnitLabel(unitPath)}: ${message}`;
      report({
        phase: "error",
        action: options.action,
        total: unitPaths.length,
        completed,
        currentUnit: unitPath,
        logs: [...logs],
      });
      throw error;
    }
  }

  if (completed > 0) {
    logs.push("Complete");
    report({
      phase: "done",
      action: options.action,
      total: unitPaths.length,
      completed,
      logs: [...logs],
    });
  }
  rememberAgentProvider(provider);
  return completed;
}

export async function runFanOutDispatchSilent(options: {
  sectionPath: string;
  action: AgentDispatchAction;
  provider?: string;
  customPrompt?: string;
}): Promise<number> {
  const provider = options.provider ?? (await getDefaultAgentProvider());
  const data = await request<{ count: number }>("/api/agent/fan-out/run", {
    method: "POST",
    body: JSON.stringify({
      sectionPath: options.sectionPath,
      action: options.action,
      provider,
      customPrompt: options.customPrompt,
      triggeredBy: getGitHubHandle() || undefined,
    }),
  });
  rememberAgentProvider(provider);
  return data.count;
}

export async function runFanOutDispatch(options: {
  sectionPath: string;
  action: AgentDispatchAction;
  provider?: string;
  customPrompt?: string;
  onSendToTerminal: (command: string) => void;
  delayMs?: number;
}): Promise<number> {
  const provider = options.provider ?? (await getDefaultAgentProvider());
  const { units } = await fanOutDispatch({
    sectionPath: options.sectionPath,
    action: options.action,
    provider,
    customPrompt: options.customPrompt,
  });
  rememberAgentProvider(provider);
  const delay = options.delayMs ?? 400;
  for (const unit of units) {
    options.onSendToTerminal(`${unit.command}\n`);
    await new Promise((resolve) => window.setTimeout(resolve, delay));
  }
  return units.length;
}

export function unitPathFromUnitFile(filePath: string): string | null {
  if (filePath.endsWith("/outline.md")) return filePath.slice(0, -"/outline.md".length);
  if (filePath.endsWith("/draft.md")) return filePath.slice(0, -"/draft.md".length);
  return null;
}

export function dispatchActionForUnitPane(
  paneLabel: string | undefined,
  _draftHasContent: boolean,
  isFigure = false,
): AgentDispatchAction | null {
  if (isFigure) {
    if (paneLabel === "Outline") return "generate-figure";
    if (paneLabel === "Draft") return "draft";
    return null;
  }
  if (paneLabel === "Outline") return "draft";
  if (paneLabel === "Draft") return "sync-outline";
  return null;
}

export function dispatchActionLabel(action: AgentDispatchAction): string {
  switch (action) {
    case "draft":
      return "Draft from outline";
    case "revise":
      return "Revise draft";
    case "sync-outline":
      return "Sync outline from draft";
    case "summarize-outline":
      return "Summarize outline from children";
    case "generate-figure":
      return "Generate Mermaid figure";
    default:
      return action;
  }
}

/** Short labels for dispatch hot buttons in the panel. */
export function dispatchHotActionLabel(action: AgentDispatchAction): string {
  switch (action) {
    case "draft":
      return "Make draft";
    case "summarize-outline":
      return "Make outline";
    case "sync-outline":
      return "Sync outline";
    case "revise":
      return "Revise";
    case "expand":
      return "Expand";
    case "cite-check":
      return "Cite-check";
    case "refresh-index":
      return "Refresh";
    case "custom":
      return "Custom";
    case "generate-figure":
      return "Make figure";
    default:
      return action;
  }
}

export function hotDispatchActions(options: { isUnit: boolean; canFanOut: boolean }): AgentDispatchAction[] {
  if (options.isUnit) {
    return ["draft", "sync-outline", "revise", "expand", "cite-check", "refresh-index", "custom"];
  }
  if (options.canFanOut) {
    return ["summarize-outline", "sync-outline", "draft", "revise", "expand", "cite-check", "custom"];
  }
  return ["refresh-index", "custom"];
}

export function isDispatchRunShortcut(
  event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "key">,
): boolean {
  return (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "r";
}

export function isDispatchPreviewShortcut(
  event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "key">,
): boolean {
  return (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p";
}
