export type WorkspaceNavTab = "explorer" | "papers";

export type PapersSidebarPanels = {
  sectionsOpen: boolean;
  assetsOpen: boolean;
  removedOpen: boolean;
  graphOpen: boolean;
};

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
  papersSidebar: PapersSidebarPanels;
};

const STORAGE_KEY = "treewriter.workspace.v1";

const DEFAULT_PAPERS_SIDEBAR: PapersSidebarPanels = {
  sectionsOpen: true,
  assetsOpen: true,
  removedOpen: false,
  graphOpen: true,
};

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
  papersSidebar: DEFAULT_PAPERS_SIDEBAR,
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
    if (parsed.papersSidebar && typeof parsed.papersSidebar === "object") {
      parsed.papersSidebar = {
        ...DEFAULT_PAPERS_SIDEBAR,
        ...parsed.papersSidebar,
      };
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveWorkspacePreferences(prefs: Partial<WorkspacePreferences>): void {
  try {
    const merged = mergeWorkspaceDefaults({
      ...loadWorkspacePreferences(),
      ...prefs,
      papersSidebar: {
        ...DEFAULT_PAPERS_SIDEBAR,
        ...loadWorkspacePreferences().papersSidebar,
        ...prefs.papersSidebar,
      },
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // quota or private mode — ignore
  }
}

export function mergeWorkspaceDefaults(
  partial: Partial<WorkspacePreferences>,
): WorkspacePreferences {
  return { ...DEFAULTS, ...partial };
}
