import { useEffect, useRef } from "react";

import type { EditorLayout } from "@/components/editor/MarkdownEditor";
import type { WorkspaceNavTab } from "@/components/nav/WorkspaceNav";
import { useCommandPalette } from "@/lib/CommandPaletteProvider";
import type { AppCommand } from "@/lib/commandPaletteTypes";
import type { NodeKind } from "@/modelApi";

export type AppView = "workspace" | "settings" | "info";

export type AppCommandsContext = {
  appView: AppView;
  sidebarTab: WorkspaceNavTab;
  editorLayout: EditorLayout;
  canGoUp: boolean;
  canCreateUnit: boolean;
  canCreateSection: boolean;
  canCreateSubsection: boolean;
  showSectionViewBack: boolean;
  onSetAppView: (view: AppView) => void;
  onSetSidebarTab: (tab: WorkspaceNavTab) => void;
  onNavigateUp: () => void;
  onBack: () => void;
  onCreateChild: (kind: NodeKind) => void;
  onRefreshModel: () => void;
  onToggleBottomPanel: () => void;
  onToggleReadingFocus: () => void;
  onSetEditorLayout: (layout: EditorLayout) => void;
  onGitSync: () => void;
  onCycleTheme: () => void;
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
        id: "workspace.explorer",
        label: "Switch to Explorer",
        category: "Navigation",
        aliases: ["files", "model"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarTab("explorer"),
      },
      {
        id: "workspace.papers",
        label: "Switch to Papers",
        category: "Navigation",
        aliases: ["manuscript", "paper"],
        when: () => ctx().appView === "workspace",
        run: () => ctx().onSetSidebarTab("papers"),
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
