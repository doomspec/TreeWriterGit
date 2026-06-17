export type WorkspaceNavTab = "explorer" | "papers";

export type WorkspacePreferences = {
  sidebarTab: WorkspaceNavTab;
  currentPath: string;
  activeFile: string | null;
  editorLayout: "source" | "split" | "preview";
  agentPanelOpen: boolean;
  searchQuery: string;
  graphRoot: string;
  graphScope: "local" | "global";
  dualPaneSplit: number;
  sidebarWidth: number;
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
  sidebarWidth: 240,
};

export function loadWorkspacePreferences(): Partial<WorkspacePreferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    if ((parsed as { sidebarTab?: string }).sidebarTab === "graph") {
      parsed.sidebarTab = "papers";
    }
    if (typeof parsed.dualPaneSplit === "number") {
      parsed.dualPaneSplit = Math.min(80, Math.max(20, parsed.dualPaneSplit));
    }
    if (typeof parsed.sidebarWidth === "number") {
      parsed.sidebarWidth = Math.min(520, Math.max(180, Math.round(parsed.sidebarWidth)));
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
