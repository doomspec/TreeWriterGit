export type WorkspaceNavTab = "explorer" | "papers";

/** Left rail panel: explorer/papers reuse WorkspaceNav; graph/outline/export/import are dedicated panels. */
export type SidebarPanel = "explorer" | "papers" | "graph" | "outline" | "export" | "import";

export type DualPaneActive = "outline" | "draft" | "notes";

export type { EditorPaneId, EditorVisiblePanes } from "@/lib/editorVisiblePanes";
export { DEFAULT_EDITOR_VISIBLE_PANES } from "@/lib/editorVisiblePanes";

import {
  DEFAULT_EDITOR_VISIBLE_PANES,
  migrateLegacyPanePrefs,
  normalizeEditorVisiblePanes,
  type EditorVisiblePanes,
  type LegacyDualPaneView,
} from "@/lib/editorVisiblePanes";
import {
  sanitizeEditorPanePrefsByScope,
  type EditorPaneScopePrefs,
} from "@/lib/editorPaneScopePrefs";

export const DUAL_PANE_NOTES_SPLIT_MIN = 20;
export const DUAL_PANE_NOTES_SPLIT_MAX = 75;
export const DUAL_PANE_NOTES_SPLIT_DEFAULT = 70;

export function clampDualPaneNotesSplit(
  percent: number,
  min = DUAL_PANE_NOTES_SPLIT_MIN,
  max = DUAL_PANE_NOTES_SPLIT_MAX,
): number {
  return Math.min(max, Math.max(min, Math.round(percent)));
}

export type PapersSidebarPanels = {
  sectionsOpen: boolean;
  assetsOpen: boolean;
  removedOpen: boolean;
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
  editorVisiblePanes: EditorVisiblePanes;
  dualPaneActive: DualPaneActive;
  /** Top share (percent) when splitting draft from notes vertically. */
  dualPaneNotesSplitPercent: number;
  /** Top share (percent) when splitting editor from figure/equation preview. */
  assetPreviewSplit: number;
  sidebarWidth: number;
  sidebarPanel: SidebarPanel;
  sidebarPanelOpen: boolean;
  /** When false, the panel is shown on hover only; the icon rail stays visible. */
  sidebarPinned: boolean;
  bottomPanelHeight: number;
  /** Last opened paper root (`papers/{slug}`), used for the home link. */
  lastPaperPath: string | null;
  /** Per editor-container pane layout (paper / section / unit paths). */
  editorPanePrefsByScope: Record<string, EditorPaneScopePrefs>;
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
  editorVisiblePanes: DEFAULT_EDITOR_VISIBLE_PANES,
  dualPaneActive: "outline",
  dualPaneNotesSplitPercent: DUAL_PANE_NOTES_SPLIT_DEFAULT,
  assetPreviewSplit: ASSET_PREVIEW_SPLIT_DEFAULT,
  sidebarWidth: 240,
  sidebarPanel: "papers",
  sidebarPanelOpen: true,
  sidebarPinned: true,
  bottomPanelHeight: BOTTOM_PANEL_HEIGHT_DEFAULT,
  lastPaperPath: null,
  editorPanePrefsByScope: {},
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
    if (parsed.editorVisiblePanes && typeof parsed.editorVisiblePanes === "object") {
      parsed.editorVisiblePanes = normalizeEditorVisiblePanes(
        parsed.editorVisiblePanes as Partial<EditorVisiblePanes>,
      );
    } else {
      const legacyView = (parsed as { dualPaneView?: LegacyDualPaneView }).dualPaneView;
      const legacyNotesStrip = (parsed as { notesStripOpen?: boolean }).notesStripOpen;
      parsed.editorVisiblePanes = migrateLegacyPanePrefs(legacyView, legacyNotesStrip);
      delete (parsed as { dualPaneView?: LegacyDualPaneView }).dualPaneView;
      delete (parsed as { notesStripOpen?: boolean }).notesStripOpen;
    }
    if (
      parsed.dualPaneActive !== "outline" &&
      parsed.dualPaneActive !== "draft" &&
      parsed.dualPaneActive !== "notes"
    ) {
      delete parsed.dualPaneActive;
    }
    if (typeof parsed.dualPaneNotesSplitPercent === "number") {
      parsed.dualPaneNotesSplitPercent = clampDualPaneNotesSplit(parsed.dualPaneNotesSplitPercent);
    } else {
      delete parsed.dualPaneNotesSplitPercent;
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
      panel !== "export" &&
      panel !== "import"
    ) {
      delete (parsed as { sidebarPanel?: string }).sidebarPanel;
    }
    if (typeof (parsed as { sidebarPanelOpen?: boolean }).sidebarPanelOpen !== "boolean") {
      delete (parsed as { sidebarPanelOpen?: boolean }).sidebarPanelOpen;
    }
    if (typeof (parsed as { sidebarPinned?: boolean }).sidebarPinned !== "boolean") {
      delete (parsed as { sidebarPinned?: boolean }).sidebarPinned;
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
    if (
      typeof parsed.lastPaperPath === "string" &&
      !/^papers\/[^/]+$/.test(parsed.lastPaperPath)
    ) {
      delete parsed.lastPaperPath;
    }
    if (parsed.editorPanePrefsByScope && typeof parsed.editorPanePrefsByScope === "object") {
      parsed.editorPanePrefsByScope = sanitizeEditorPanePrefsByScope(
        parsed.editorPanePrefsByScope as Record<string, EditorPaneScopePrefs>,
      );
    } else {
      delete parsed.editorPanePrefsByScope;
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
  return {
    ...DEFAULTS,
    ...partial,
    editorPanePrefsByScope: sanitizeEditorPanePrefsByScope(partial.editorPanePrefsByScope),
  };
}
