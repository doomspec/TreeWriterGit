export type EditorPaneMode = "rendered" | "raw" | "changes";

export type EditorSessionState = {
  paneMode?: EditorPaneMode;
  selectionStart?: number;
  selectionEnd?: number;
  scrollTop?: number;
};

const STORAGE_KEY = "treewriter.editorSession.v1";
const MAX_ENTRIES = 200;

type SessionStore = Record<string, EditorSessionState>;

function readStore(): SessionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SessionStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: SessionStore): void {
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

export function sessionKeyForFile(filePath: string): string {
  return `file:${filePath}`;
}

export function sessionKeyForComposedDraft(containerPath: string): string {
  return `composed:${containerPath}`;
}

export function loadEditorSession(sessionKey: string): EditorSessionState | null {
  if (!sessionKey) return null;
  const saved = readStore()[sessionKey];
  if (!saved || typeof saved !== "object") return null;
  return saved;
}

export function saveEditorSession(sessionKey: string, state: EditorSessionState): void {
  if (!sessionKey) return;
  const store = readStore();
  store[sessionKey] = {
    ...store[sessionKey],
    ...state,
  };
  writeStore(store);
}

const debouncedSaveTimers = new Map<string, number>();

/** Debounced write — avoids parsing/stringifying the full store on every cursor move. */
export function scheduleSaveEditorSession(
  sessionKey: string,
  state: EditorSessionState,
  delayMs = 300,
): void {
  if (!sessionKey) return;
  const existing = debouncedSaveTimers.get(sessionKey);
  if (existing !== undefined) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    debouncedSaveTimers.delete(sessionKey);
    saveEditorSession(sessionKey, state);
  }, delayMs);
  debouncedSaveTimers.set(sessionKey, timer);
}
