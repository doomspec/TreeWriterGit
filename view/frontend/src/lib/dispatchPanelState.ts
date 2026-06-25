import type { AgentDispatchAction, AgentPreviewResult } from "@/lib/agentDispatchClient";

export type PersistedDispatchPreview = {
  prompt: string;
  command: string;
  outputPath?: string;
};

export type PersistedDispatchPanelState = {
  action?: AgentDispatchAction;
  customPrompt?: string;
  preview?: PersistedDispatchPreview | null;
  editedCommand?: string;
  selectedContext?: string[];
  promptOpen?: boolean;
  selectedSessionFilename?: string | null;
};

const STORAGE_KEY = "treewriter.dispatch-panel.v1";
const MAX_ENTRIES = 100;

type PanelStore = Record<string, PersistedDispatchPanelState>;

function readStore(): PanelStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PanelStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: PanelStore): void {
  try {
    const entries = Object.entries(store);
    const trimmed =
      entries.length > MAX_ENTRIES
        ? Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES))
        : store;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota or private mode
  }
}

export function loadDispatchPanelState(path: string): PersistedDispatchPanelState | null {
  if (!path) return null;
  const saved = readStore()[path];
  if (!saved || typeof saved !== "object") return null;
  return saved;
}

export function saveDispatchPanelState(path: string, state: PersistedDispatchPanelState): void {
  if (!path) return;
  const store = readStore();
  store[path] = {
    ...store[path],
    ...state,
  };
  writeStore(store);
}

const debouncedSaveTimers = new Map<string, number>();

export function scheduleSaveDispatchPanelState(
  path: string,
  state: PersistedDispatchPanelState,
  delayMs = 300,
): void {
  if (!path) return;
  const existing = debouncedSaveTimers.get(path);
  if (existing !== undefined) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    debouncedSaveTimers.delete(path);
    saveDispatchPanelState(path, state);
  }, delayMs);
  debouncedSaveTimers.set(path, timer);
}

export function restoreDispatchPreview(
  preview: PersistedDispatchPreview | null | undefined,
): AgentPreviewResult | null {
  if (!preview) return null;
  return {
    prompt: preview.prompt,
    command: preview.command,
    outputPath: preview.outputPath ?? "",
  };
}
