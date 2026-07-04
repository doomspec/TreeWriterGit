const STORAGE_VERSION = 1;
const STORAGE_VERSION_KEY = "treewriter.storage.version";

/** Canonical keys for workspace persistence (migrate legacy keys here over time). */
export const WORKSPACE_STORAGE_KEYS = {
  preferences: "treewriter.workspace.v1",
  editorSession: "treewriter.editor.session.v1",
  terminalSession: "treewriter.terminal.session.v1",
  dispatchPanel: "treewriter.dispatch.panel.v1",
  readingFocus: "treewriter.reading-focus.v1",
  theme: "treewriter.theme.v1",
} as const;

const LEGACY_KEY_MAP: Record<string, string> = {
  "treewriter.workspace.preferences.v1": WORKSPACE_STORAGE_KEYS.preferences,
  "treewriter.readingFocus.v1": WORKSPACE_STORAGE_KEYS.readingFocus,
};

export function migrateWorkspaceStorage(): void {
  try {
    const current = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? "0");
    if (current >= STORAGE_VERSION) return;

    for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_KEY_MAP)) {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue !== null && localStorage.getItem(canonicalKey) === null) {
        localStorage.setItem(canonicalKey, legacyValue);
      }
      localStorage.removeItem(legacyKey);
    }

    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  } catch {
    // private mode / quota — ignore
  }
}

export function clearWorkspaceStorage(): void {
  try {
    for (const key of Object.values(WORKSPACE_STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(STORAGE_VERSION_KEY);
  } catch {
    // ignore
  }
}
