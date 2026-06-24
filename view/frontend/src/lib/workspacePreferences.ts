export type WorkspaceNavTab = "explorer" | "papers";

/** Left rail panel: explorer/papers reuse WorkspaceNav; graph/outline/export are dedicated panels. */
export type SidebarPanel = "explorer" | "papers" | "graph" | "outline" | "export";

export type DualPaneView = "outline" | "draft" | "split";
export type DualPaneActive = "outline" | "draft";

export type PapersSidebarPanels = {
  sectionsOpen: boolean;
  assetsOpen: boolean;
  removedOpen: boolean;
  graphOpen: boolean;
};

export const ASSET_PREVIEW_SPLIT_MIN = 25;
export const ASSET_PREVIEW_SPLIT_MAX = 80;
export const ASSET_PREVIEW_SPLIT_DEFAULT = 58;

export function clampAssetPreviewSplit(
  percent: number,
  min = ASSET_PREVIEW_SPLIT_MIN,
  max = ASSET_PREVIEW_SPLIT_MAX,
): number {
  return Math.min(max, Math.max(min, Math.round(percent)));
}

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
  /** Top share (percent) when splitting editor from figure/equation preview. */
  assetPreviewSplit: number;
  sidebarWidth: number;
  sidebarPanel: SidebarPanel;
  sidebarPanelOpen: boolean;
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
  assetPreviewSplit: ASSET_PREVIEW_SPLIT_DEFAULT,
  sidebarWidth: 240,
  sidebarPanel: "papers",
  sidebarPanelOpen: true,
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
    if (typeof parsed.assetPreviewSplit === "number") {
      parsed.assetPreviewSplit = clampAssetPreviewSplit(parsed.assetPreviewSplit);
    } else {
      delete parsed.assetPreviewSplit;
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
    const panel = (parsed as { sidebarPanel?: string }).sidebarPanel;
    if (
      panel !== "explorer" &&
      panel !== "papers" &&
      panel !== "graph" &&
      panel !== "outline" &&
      panel !== "export"
    ) {
      delete (parsed as { sidebarPanel?: string }).sidebarPanel;
    }
    if (typeof (parsed as { sidebarPanelOpen?: boolean }).sidebarPanelOpen !== "boolean") {
      delete (parsed as { sidebarPanelOpen?: boolean }).sidebarPanelOpen;
    }
    if (!(parsed as { sidebarPanel?: string }).sidebarPanel && parsed.sidebarTab) {
      (parsed as { sidebarPanel?: SidebarPanel }).sidebarPanel = parsed.sidebarTab;
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
