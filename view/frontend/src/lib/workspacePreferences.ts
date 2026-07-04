/** Left rail panel ids — see sidebarPanelNavItems.ts */
export type SidebarPanel =
  | "papers"
  | "paperInfo"
  | "assets"
  | "removed"
  | "graph"
  | "references"
  | "export"
  | "review";

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

export const BIB_PREVIEW_SPLIT_MIN = 20;
export const BIB_PREVIEW_SPLIT_MAX = 45;
export const BIB_PREVIEW_SPLIT_DEFAULT = 32;

export function clampBibPreviewSplit(
  percent: number,
  min = BIB_PREVIEW_SPLIT_MIN,
  max = BIB_PREVIEW_SPLIT_MAX,
): number {
  return Math.min(max, Math.max(min, Math.round(percent)));
}

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
  /** Left share (percent) for BibTeX entry list inside preview pane. */
  bibPreviewSplit: number;
  sidebarWidth: number;
  sidebarPanel: SidebarPanel;
  sidebarPanelOpen: boolean;
  /** When false, the panel is shown on hover only; the icon rail stays visible. */
  sidebarPinned: boolean;
  bottomPanelHeight: number;
  /** When false, the per-file review rail is hidden in editors. */
  reviewRailOpen: boolean;
  /** Last opened paper root (`papers/{slug}`), used for the home link. */
  lastPaperPath: string | null;
  /** Per editor-container pane layout (paper / section / unit paths). */
  editorPanePrefsByScope: Record<string, EditorPaneScopePrefs>;
  /** When true, main.bib split view loads the full raw file instead of entry-only source. */
  loadLargeBibSource: boolean;
  /** When true, the app shows the IDE-style Explorer workspace instead of the authoring workspace. */
  explorerMode: boolean;
  /** Open file paths (project-root-relative) for Explorer mode tabs. */
  explorerOpenTabs: string[];
  /** Active Explorer tab path. */
  explorerActiveTab: string | null;
  /** Right-docked AI assistant chat panel. */
  aiPanelOpen: boolean;
  /** AI assistant panel width in px. */
  aiPanelWidth: number;
  /** Collapsible terminal section inside the assistant panel. */
  aiPanelTerminalOpen: boolean;
  /** Collapsible dispatch section inside the assistant panel. */
  aiPanelDispatchOpen: boolean;
  /** Collapsible skills section inside the assistant panel. */
  aiPanelSkillsOpen: boolean;
};

export const AI_PANEL_WIDTH_MIN = 280;
export const AI_PANEL_WIDTH_MAX = 640;
export const AI_PANEL_WIDTH_DEFAULT = 380;

export function clampAiPanelWidth(width: number): number {
  return Math.min(AI_PANEL_WIDTH_MAX, Math.max(AI_PANEL_WIDTH_MIN, Math.round(width)));
}

export const BOTTOM_PANEL_HEIGHT_MIN = 160;
export const BOTTOM_PANEL_HEIGHT_MAX = 720;
export const BOTTOM_PANEL_HEIGHT_DEFAULT = 320;

export function clampBottomPanelHeight(height: number): number {
  return Math.min(BOTTOM_PANEL_HEIGHT_MAX, Math.max(BOTTOM_PANEL_HEIGHT_MIN, Math.round(height)));
}

const STORAGE_KEY = "treewriter.workspace.v1";

const LEGACY_SIDEBAR_TAB_TO_PANEL: Record<string, SidebarPanel> = {
  papers: "papers",
  graph: "graph",
  explorer: "papers",
};

function isSidebarPanel(value: string | undefined): value is SidebarPanel {
  return (
    value === "papers" ||
    value === "paperInfo" ||
    value === "assets" ||
    value === "removed" ||
    value === "graph" ||
    value === "export" ||
    value === "review" ||
    value === "references"
  );
}

const DEFAULTS: WorkspacePreferences = {
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
  bibPreviewSplit: BIB_PREVIEW_SPLIT_DEFAULT,
  sidebarWidth: 240,
  sidebarPanel: "paperInfo",
  sidebarPanelOpen: true,
  sidebarPinned: true,
  reviewRailOpen: true,
  bottomPanelHeight: BOTTOM_PANEL_HEIGHT_DEFAULT,
  lastPaperPath: null,
  editorPanePrefsByScope: {},
  loadLargeBibSource: false,
  explorerMode: false,
  explorerOpenTabs: [],
  explorerActiveTab: null,
  aiPanelOpen: false,
  aiPanelWidth: AI_PANEL_WIDTH_DEFAULT,
  aiPanelTerminalOpen: true,
  aiPanelDispatchOpen: false,
  aiPanelSkillsOpen: false,
};

export function loadWorkspacePreferences(): Partial<WorkspacePreferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences> & { sidebarTab?: string };
    if (!(parsed as { sidebarPanel?: string }).sidebarPanel && parsed.sidebarTab) {
      const legacyTab = String(parsed.sidebarTab);
      (parsed as { sidebarPanel?: SidebarPanel }).sidebarPanel =
        LEGACY_SIDEBAR_TAB_TO_PANEL[legacyTab] ?? "paperInfo";
    }
    delete parsed.sidebarTab;
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
    if (panel === "findPaper" || panel === "import" || panel === "outline") {
      (parsed as { sidebarPanel?: SidebarPanel }).sidebarPanel = "paperInfo";
    }
    const normalizedPanel = (parsed as { sidebarPanel?: string }).sidebarPanel;
    if (!isSidebarPanel(normalizedPanel)) {
      delete (parsed as { sidebarPanel?: string }).sidebarPanel;
    }
    if (typeof (parsed as { sidebarPanelOpen?: boolean }).sidebarPanelOpen !== "boolean") {
      delete (parsed as { sidebarPanelOpen?: boolean }).sidebarPanelOpen;
    }
    if (typeof (parsed as { sidebarPinned?: boolean }).sidebarPinned !== "boolean") {
      delete (parsed as { sidebarPinned?: boolean }).sidebarPinned;
    }
    if (typeof (parsed as { reviewRailOpen?: boolean }).reviewRailOpen !== "boolean") {
      delete (parsed as { reviewRailOpen?: boolean }).reviewRailOpen;
    }
    if (typeof parsed.bottomPanelHeight === "number") {
      parsed.bottomPanelHeight = clampBottomPanelHeight(parsed.bottomPanelHeight);
    }
    if (typeof (parsed as { bibPreviewSplit?: number }).bibPreviewSplit === "number") {
      (parsed as { bibPreviewSplit?: number }).bibPreviewSplit = clampBibPreviewSplit(
        (parsed as { bibPreviewSplit?: number }).bibPreviewSplit!,
      );
    }
    if (typeof (parsed as { loadLargeBibSource?: boolean }).loadLargeBibSource !== "boolean") {
      delete (parsed as { loadLargeBibSource?: boolean }).loadLargeBibSource;
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
    if (typeof (parsed as { aiPanelOpen?: boolean }).aiPanelOpen !== "boolean") {
      delete (parsed as { aiPanelOpen?: boolean }).aiPanelOpen;
    }
    if (typeof (parsed as { aiPanelWidth?: number }).aiPanelWidth === "number") {
      (parsed as { aiPanelWidth?: number }).aiPanelWidth = clampAiPanelWidth(
        (parsed as { aiPanelWidth?: number }).aiPanelWidth!,
      );
    } else {
      delete (parsed as { aiPanelWidth?: number }).aiPanelWidth;
    }
    if (typeof (parsed as { aiPanelTerminalOpen?: boolean }).aiPanelTerminalOpen !== "boolean") {
      delete (parsed as { aiPanelTerminalOpen?: boolean }).aiPanelTerminalOpen;
    }
    if (typeof (parsed as { aiPanelDispatchOpen?: boolean }).aiPanelDispatchOpen !== "boolean") {
      delete (parsed as { aiPanelDispatchOpen?: boolean }).aiPanelDispatchOpen;
    }
    if (typeof (parsed as { aiPanelSkillsOpen?: boolean }).aiPanelSkillsOpen !== "boolean") {
      delete (parsed as { aiPanelSkillsOpen?: boolean }).aiPanelSkillsOpen;
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
