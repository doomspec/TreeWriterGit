import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { PaperWorkspace } from "@/components/editor/PaperWorkspace";
import { SectionWorkspace } from "@/components/editor/SectionWorkspace";
import { TableWorkspace } from "@/components/editor/TableWorkspace";
import { FolderBrowse } from "@/components/nav/FolderBrowse";
import {
  findNode,
  isEquationFolder,
  isFigureFolder,
  manuscriptContainerPathFromFile,
  outlinePathFor,
  parentPath,
} from "@/lib/modelTree";
import { resolveModelReloadScope } from "@/lib/modelReloadScope";
import { resolveWorkspaceView } from "@/lib/resolveWorkspaceView";
import { useWorkspaceLayout } from "@/lib/workspace/WorkspaceLayoutContext";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";

type WorkspaceRouterProps = {
  onError: (message: string) => void;
  onSendToTerminal: (command: string) => void;
  onBeforeDispatch: () => void;
  onDispatchComplete: () => void;
};

export function WorkspaceRouter({
  onError,
  onSendToTerminal,
  onBeforeDispatch,
  onDispatchComplete,
}: WorkspaceRouterProps) {
  const nav = useWorkspaceNavigationContext();
  const layout = useWorkspaceLayout();
  const reloadScopedModel = () =>
    nav.reloadModel(
      resolveModelReloadScope({
        browsePath: nav.browsePath,
        paperPath: nav.paperPath,
        activeFile: nav.activeFile,
      }),
    );

  const paneLayoutProps = {
    visiblePanes: layout.editorVisiblePanes,
    onVisiblePanesChange: layout.setEditorVisiblePanes,
    notesSplitPercent: layout.dualPaneNotesSplitPercent,
    onNotesSplitChange: layout.setDualPaneNotesSplitPercent,
  };

  const view = resolveWorkspaceView({
    paperWorkspacePath: nav.paperWorkspacePath,
    tablePath: nav.tablePath,
    sectionPath: nav.sectionPath,
    unitPath: nav.unitPath,
    activeFile: nav.activeFile,
  });

  if (view.kind === "paper") {
    return (
      <PaperWorkspace
        paperPath={view.path}
        refreshVersion={nav.refreshVersion}
        onNavigate={nav.navigateTo}
        onOpenFile={nav.openFile}
        onError={onError}
        dualPaneSplit={layout.dualPaneSplit}
        onDualPaneSplitChange={layout.setDualPaneSplit}
        activePane={layout.dualPaneActive}
        onActivePaneChange={layout.setDualPaneActive}
        getPathVersion={nav.getPathVersion}
        {...paneLayoutProps}
        onDispatchComplete={onDispatchComplete}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
      />
    );
  }

  if (view.kind === "table") {
    return (
      <TableWorkspace
        tablePath={view.path}
        tableTitle={nav.tableTitle}
        refreshVersion={nav.refreshVersion}
        onError={onError}
        onNavigate={nav.handleMarkdownNavigate}
        onDispatchComplete={onDispatchComplete}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
        onModelChanged={reloadScopedModel}
        paperPath={nav.paperPath}
        dualPaneSplit={layout.dualPaneSplit}
        onDualPaneSplitChange={layout.setDualPaneSplit}
        activePane={layout.dualPaneActive}
        onActivePaneChange={layout.setDualPaneActive}
        {...paneLayoutProps}
      />
    );
  }

  if (view.kind === "section") {
    return (
      <SectionWorkspace
        sectionPath={view.path}
        refreshVersion={nav.refreshVersion}
        onNavigate={nav.navigateTo}
        onOpenFile={nav.openFile}
        onError={onError}
        dualPaneSplit={layout.dualPaneSplit}
        onDualPaneSplitChange={layout.setDualPaneSplit}
        activePane={layout.dualPaneActive}
        onActivePaneChange={layout.setDualPaneActive}
        getPathVersion={nav.getPathVersion}
        {...paneLayoutProps}
        onDispatchComplete={onDispatchComplete}
      />
    );
  }

  if (view.kind === "editor") {
    const editorContainerPath =
      view.unitPath ?? manuscriptContainerPathFromFile(view.activeFile) ?? null;
    const editorContainerNode = editorContainerPath ? findNode(nav.tree, editorContainerPath) : null;
    return (
      <EditorWorkspace
        unitPath={editorContainerPath}
        activeFile={view.activeFile ?? (editorContainerPath ? outlinePathFor(editorContainerPath) : "")}
        refreshVersion={nav.refreshVersion}
        getPathVersion={nav.getPathVersion}
        layout={layout.editorLayout}
        onLayoutChange={layout.setEditorLayout}
        onError={onError}
        linkContextPath={view.unitPath ?? parentPath(view.activeFile ?? "")}
        onNavigate={nav.handleMarkdownNavigate}
        dualPaneSplit={layout.dualPaneSplit}
        onDualPaneSplitChange={layout.setDualPaneSplit}
        assetPreviewSplit={layout.assetPreviewSplit}
        onAssetPreviewSplitChange={layout.setAssetPreviewSplit}
        activePane={layout.dualPaneActive}
        onActivePaneChange={layout.setDualPaneActive}
        {...paneLayoutProps}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
        onDispatchComplete={onDispatchComplete}
        isFigure={view.unitPath ? nav.isFigure : isFigureFolder(editorContainerNode)}
        isEquation={view.unitPath ? nav.isEquation : isEquationFolder(editorContainerNode)}
        onModelChanged={reloadScopedModel}
        paperPath={nav.paperPath}
      />
    );
  }

  return (
    <FolderBrowse
      tree={nav.tree}
      currentPath={nav.browsePath}
      onOpenFolder={nav.navigateTo}
      onOpenFile={nav.openFile}
      onChanged={reloadScopedModel}
      onError={onError}
      onSendToTerminal={onSendToTerminal}
      onNavigate={nav.handleMarkdownNavigate}
    />
  );
}
