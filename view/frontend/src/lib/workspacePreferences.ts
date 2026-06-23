export type WorkspaceNavTab = "explorer" | "papers";

export type DualPaneView = "outline" | "draft" | "split";
export type DualPaneActive = "outline" | "draft";

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
  dualPaneView: DualPaneView;
  dualPaneActive: DualPaneActive;
  sidebarWidth: number;
  bottomPanelHeight: number;
  papersSidebar: PapersSidebarPanels;
};

export const BOTTOM_PANEL_HEIGHT_MIN = 160;
export const BOTTOM_PANEL_HEIGHT_MAX = 720;
export const BOTTOM_PANEL_HEIGHT_DEFAULT = 320;

export function clampBottomPanelHeight(height: number): number {
  return Math.min(BOTTOM_PANEL_HEIGHT_MAX, Math.max(BOTTOM_PANEL_HEIGHT_MIN, Math.round(height)));
}

const STORAGE_KEY = "treewriter.workspace.v1";

const DEFAULT_PAPERS_SIDEBAR: PapersSidebarPanels = {
  sectionsOpen: true,
  assetsOpen: false,
  removedOpen: false,
  graphOpen: false,
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
  dualPaneView: "split",
  dualPaneActive: "outline",
  sidebarWidth: 240,
  bottomPanelHeight: BOTTOM_PANEL_HEIGHT_DEFAULT,
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
    if (
      parsed.dualPaneView !== "outline" &&
      parsed.dualPaneView !== "draft" &&
      parsed.dualPaneView !== "split"
    ) {
      delete parsed.dualPaneView;
    }
    if (parsed.dualPaneActive !== "outline" && parsed.dualPaneActive !== "draft") {
      delete parsed.dualPaneActive;
    }
    if (typeof parsed.sidebarWidth === "number") {
      parsed.sidebarWidth = Math.min(520, Math.max(180, Math.round(parsed.sidebarWidth)));
    }
    if (typeof parsed.bottomPanelHeight === "number") {
      parsed.bottomPanelHeight = clampBottomPanelHeight(parsed.bottomPanelHeight);
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
    const current = loadWorkspacePreferences();
    const merged = mergeWorkspaceDefaults({
      ...current,
      ...prefs,
      papersSidebar: {
        ...DEFAULT_PAPERS_SIDEBAR,
        ...current.papersSidebar,
        ...prefs.papersSidebar,
      },
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // quota or private mode — ignore
  }
}

let pendingWorkspacePrefs: Partial<WorkspacePreferences> | null = null;
let workspaceSaveTimer: number | undefined;

/** Debounced localStorage write for layout/navigation prefs. */
export function scheduleSaveWorkspacePreferences(
  prefs: Partial<WorkspacePreferences>,
  delayMs = 500,
): void {
  pendingWorkspacePrefs = { ...pendingWorkspacePrefs, ...prefs };
  window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = window.setTimeout(() => {
    if (pendingWorkspacePrefs) {
      saveWorkspacePreferences(pendingWorkspacePrefs);
      pendingWorkspacePrefs = null;
    }
  }, delayMs);
}

export function mergeWorkspaceDefaults(
  partial: Partial<WorkspacePreferences>,
): WorkspacePreferences {
  return { ...DEFAULTS, ...partial };
}
