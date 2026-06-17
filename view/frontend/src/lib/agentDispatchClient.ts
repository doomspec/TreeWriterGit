import { fanOutDispatch, fetchContextFiles } from "@/modelApi";
import { resolveAgentProvider, saveLastAgentProvider } from "@/lib/lastAgentProvider";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type AgentDispatchAction =
  | "draft"
  | "revise"
  | "expand"
  | "cite-check"
  | "custom"
  | "refresh-index"
  | "sync-outline";

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
  const res = await fetch(`${apiBaseUrl}/api/agent/providers`);
  if (!res.ok) throw new Error(`Providers load failed (${res.status})`);
  providersCache = (await res.json()) as ProviderConfig;
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

  const res = await fetch(`${apiBaseUrl}/api/agent/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      unitPath: options.unitPath,
      action: options.action,
      provider,
      customPrompt: options.customPrompt,
      sessionId,
      contextPaths,
    }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Preview failed (${res.status})`);
  }
  return (await res.json()) as AgentPreviewResult;
}

async function recordAgentSession(options: {
  unitPath: string;
  provider: string;
  action: AgentDispatchAction;
  command: string;
}): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitPath: options.unitPath,
        provider: options.provider,
        action: options.action,
        command: options.command,
        status: "dispatched",
      }),
    });
  } catch {
    // non-fatal
  }
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
  draftHasContent: boolean,
): AgentDispatchAction | null {
  if (paneLabel === "Outline") return "draft";
  if (paneLabel === "Draft") return draftHasContent ? "revise" : "draft";
  return null;
}

export function dispatchActionLabel(action: AgentDispatchAction): string {
  switch (action) {
    case "draft":
      return "Draft from outline";
    case "revise":
      return "Revise draft";
    case "sync-outline":
      return "Sync outline";
    default:
      return action;
  }
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
