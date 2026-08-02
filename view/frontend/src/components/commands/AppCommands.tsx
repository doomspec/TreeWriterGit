import { useEffect, useRef } from "react";

import type { EditorLayout } from "@/components/editor/MarkdownEditor";
import type { SidebarPanel } from "@/lib/workspacePreferences";
import { useCommandPalette } from "@/lib/CommandPaletteProvider";
import type { AppCommand } from "@/lib/commandPaletteTypes";
import type { EditorPaneId } from "@/lib/editorVisiblePanes";
import type { NodeKind } from "@/modelApi";

export type AppView = "workspace" | "settings" | "info";

export type AppCommandsContext = {
  appView: AppView;
  editorLayout: EditorLayout;
  canGoUp: boolean;
  canCreateUnit: boolean;
  canCreateSection: boolean;
  canCreateSubsection: boolean;
  showSectionViewBack: boolean;
  dualPaneEditorActive: boolean;
  notesPaneAvailable: boolean;
  pendingAiReviewCount: number;
  selectedBibCiteKey: string | null;
  onSetAppView: (view: AppView) => void;
  onSetSidebarPanel: (panel: SidebarPanel) => void;
  onToggleSidebarPanel: () => void;
  onNavigateUp: () => void;
  onBack: () => void;
  onCreateChild: (kind: NodeKind) => void;
  onRefreshModel: () => void;
  onToggleBottomPanel: () => void;
  onToggleReadingFocus: () => void;
  onSetEditorLayout: (layout: EditorLayout) => void;
  onGitSync: () => void;
  onCycleTheme: () => void;
  onToggleEditorPane: (pane: EditorPaneId) => void;
  onApproveAllAiChanges: () => void;
  onOpenMainBib: (citeKey?: string) => void;
  onShowUnverifiedReferences: () => void;
  onOpenDocxImport?: () => void;
};

export function AppCommands(context: AppCommandsContext) {
  const { registerCommands, openPalette } = useCommandPalette();
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    const ctx = () => contextRef.current;

    const commands: AppCommand[] = [
      {
        id: "palette.open",
        label: "Show command palette",
        category: "General",
        aliases: ["commands", "search", "palette", "goto"],
        run: () => openPalette(),
      },
      {
        id: "info.open",
        label: "Open guide",
        category: "General",
        aliases: ["help", "documentation", "shortcuts", "features", "about"],
        run: () => ctx().onSetAppView(ctx().appView === "info" ? "workspace" : "info"),
      },
      {
        id: "settings.open",
        label: "Open settings",
        category: "General",
        aliases: ["preferences", "config"],
        run: () => ctx().onSetAppView(ctx().appView === "settings" ? "workspace" : "settings"),
      },
      {
        id: "workspace.papers",
        label: "Switch to Sections",
        category: "Navigation",
        aliases: ["manuscript", "paper", "papers"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarPanel("papers"),
      },
      {
        id: "sidebar.assets",
        label: "Show assets panel",
        category: "Navigation",
        aliases: ["figures", "tables", "equations", "assets"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarPanel("assets"),
      },
      {
        id: "sidebar.removed",
        label: "Show removed items",
        category: "Navigation",
        aliases: ["trash", "deleted", "removed", "restore"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarPanel("removed"),
      },
      {
        id: "sidebar.references",
        label: "Show references library",
        category: "Navigation",
        aliases: ["bibtex", "bibliography", "citations", "main.bib", "refs"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarPanel("references"),
      },
      {
        id: "references.openMainBib",
        label: "Open main.bib",
        category: "References",
        aliases: ["bibliography editor", "edit references"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onOpenMainBib(ctx().selectedBibCiteKey ?? undefined),
      },
      {
        id: "references.unverified",
        label: "Show unverified references",
        category: "References",
        aliases: ["review references", "verify bibliography"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onShowUnverifiedReferences(),
      },
      {
        id: "sidebar.graph",
        label: "Show link graph",
        category: "Navigation",
        aliases: ["graph panel", "links"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarPanel("graph"),
      },
      {
        id: "sidebar.export",
        label: "Show export panel",
        category: "Navigation",
        aliases: ["export", "overleaf", "latex", "pdf", "download"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarPanel("export"),
      },
      {
        id: "sidebar.review",
        label: "Open review panel",
        category: "Navigation",
        aliases: ["review", "pending changes", "track changes", "approve"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarPanel("review"),
      },
      {
        id: "review.approveAllAi",
        label: "Approve all AI changes",
        category: "Review",
        aliases: ["accept ai", "approve agent changes", "approve bot"],
        when: () => ctx().appView === "workspace" && ctx().pendingAiReviewCount > 0,
        run: () => ctx().onApproveAllAiChanges(),
      },
      {
        id: "sidebar.import",
        label: "Import from Word",
        category: "Navigation",
        aliases: ["import", "docx", "word", "upload document"],
        when: () => ctx().appView === "workspace" && Boolean(ctx().onOpenDocxImport),
        run: () => ctx().onOpenDocxImport?.(),
      },
      {
        id: "sidebar.toggle",
        label: "Toggle sidebar panel",
        category: "View",
        aliases: ["collapse sidebar", "expand sidebar"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onToggleSidebarPanel(),
      },
      {
        id: "navigate.up",
        label: "Go up one folder",
        category: "Navigation",
        aliases: ["parent", "back folder"],
        when: () => ctx().appView === "workspace" && ctx().canGoUp,
        run: () => ctx().onNavigateUp(),
      },
      {
        id: "navigate.back",
        label: "Back to section view",
        category: "Navigation",
        aliases: ["return", "section view"],
        when: () => ctx().appView === "workspace" && ctx().showSectionViewBack,
        run: () => ctx().onBack(),
      },
      {
        id: "create.section",
        label: "New section",
        category: "Create",
        aliases: ["add section", "folder"],
        when: () => ctx().appView === "workspace" && ctx().canCreateSection,
        run: () => ctx().onCreateChild("section"),
      },
      {
        id: "create.subsection",
        label: "New subsection",
        category: "Create",
        aliases: ["add subsection"],
        when: () => ctx().appView === "workspace" && ctx().canCreateSubsection,
        run: () => ctx().onCreateChild("subsection"),
      },
      {
        id: "create.unit",
        label: "New unit",
        category: "Create",
        aliases: ["add unit", "new note", "new document"],
        when: () => ctx().appView === "workspace" && ctx().canCreateUnit,
        run: () => ctx().onCreateChild("unit"),
      },
      {
        id: "model.refresh",
        label: "Refresh model",
        category: "General",
        aliases: ["reload", "sync tree"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onRefreshModel(),
      },
      {
        id: "git.sync",
        label: "Git sync now",
        category: "General",
        aliases: ["push", "pull", "sync git"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onGitSync(),
      },
      {
        id: "panel.bottom.toggle",
        label: "Toggle terminal & AI panel",
        category: "View",
        aliases: ["terminal", "dispatch", "bottom panel"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onToggleBottomPanel(),
      },
      {
        id: "readingFocus.toggle",
        label: "Toggle reading focus",
        category: "View",
        aliases: ["focus mode", "distraction free", "hide interface"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onToggleReadingFocus(),
      },
      {
        id: "editor.layout.source",
        label: "Editor layout: source",
        category: "Editor",
        aliases: ["markdown source", "raw"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetEditorLayout("source"),
      },
      {
        id: "editor.layout.split",
        label: "Editor layout: split",
        category: "Editor",
        aliases: ["split view"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetEditorLayout("split"),
      },
      {
        id: "editor.layout.preview",
        label: "Editor layout: preview",
        category: "Editor",
        aliases: ["reading view", "rendered"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetEditorLayout("preview"),
      },
      {
        id: "editor.pane.outline",
        label: "Toggle outline pane",
        category: "Editor",
        aliases: ["show outline", "hide outline", "outline pane"],
        when: () => ctx().appView === "workspace" && ctx().dualPaneEditorActive,
        run: () => ctx().onToggleEditorPane("outline"),
      },
      {
        id: "editor.pane.draft",
        label: "Toggle draft pane",
        category: "Editor",
        aliases: ["show draft", "hide draft", "draft pane"],
        when: () => ctx().appView === "workspace" && ctx().dualPaneEditorActive,
        run: () => ctx().onToggleEditorPane("draft"),
      },
      {
        id: "editor.pane.notes",
        label: "Toggle notes pane",
        category: "Editor",
        aliases: ["show notes", "hide notes", "scratchpad", "temp notes"],
        when: () =>
          ctx().appView === "workspace" &&
          ctx().dualPaneEditorActive &&
          ctx().notesPaneAvailable,
        run: () => ctx().onToggleEditorPane("notes"),
      },
      {
        id: "theme.cycle",
        label: "Cycle theme",
        category: "View",
        aliases: ["dark mode", "light mode", "appearance"],
        run: () => ctx().onCycleTheme(),
      },
    ];

    return registerCommands(commands);
  }, [openPalette, registerCommands]);

  return null;
}
