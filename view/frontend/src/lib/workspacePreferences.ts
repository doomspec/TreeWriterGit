export type WorkspacePreferences = {
  sidebarTab: "explorer" | "papers" | "graph";
  currentPath: string;
  activeFile: string | null;
  editorLayout: "source" | "split" | "preview";
  agentPanelOpen: boolean;
  searchQuery: string;
  graphRoot: string;
  graphScope: "local" | "global";
  dualPaneSplit: number;
};

const STORAGE_KEY = "treewriter.workspace.v1";

const DEFAULTS: WorkspacePreferences = {
  sidebarTab: "papers",
  currentPath: "papers",
  activeFile: null,
  editorLayout: "split",
  agentPanelOpen: false,
  searchQuery: "",
  graphRoot: "",
  graphScope: "local",
  dualPaneSplit: 50,
};

export function loadWorkspacePreferences(): Partial<WorkspacePreferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    if (typeof parsed.dualPaneSplit === "number") {
      parsed.dualPaneSplit = Math.min(80, Math.max(20, parsed.dualPaneSplit));
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveWorkspacePreferences(prefs: WorkspacePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // quota or private mode — ignore
  }
}

export function mergeWorkspaceDefaults(
  partial: Partial<WorkspacePreferences>,
): WorkspacePreferences {
  return { ...DEFAULTS, ...partial };
}
