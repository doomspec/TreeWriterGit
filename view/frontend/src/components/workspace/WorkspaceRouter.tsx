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

  if (nav.paperWorkspacePath) {
    return (
      <PaperWorkspace
        paperPath={nav.paperWorkspacePath}
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

  if (nav.tablePath) {
    return (
      <TableWorkspace
        tablePath={nav.tablePath}
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

  if (nav.unitPath || nav.activeFile) {
    const editorContainerPath =
      nav.unitPath ?? manuscriptContainerPathFromFile(nav.activeFile) ?? null;
    const editorContainerNode = editorContainerPath ? findNode(nav.tree, editorContainerPath) : null;
    return (
      <EditorWorkspace
        unitPath={editorContainerPath}
        activeFile={nav.activeFile ?? (editorContainerPath ? outlinePathFor(editorContainerPath) : "")}
        refreshVersion={nav.refreshVersion}
        getPathVersion={nav.getPathVersion}
        layout={layout.editorLayout}
        onLayoutChange={layout.setEditorLayout}
        onError={onError}
        linkContextPath={nav.unitPath ?? parentPath(nav.activeFile ?? "")}
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
        isFigure={nav.unitPath ? nav.isFigure : isFigureFolder(editorContainerNode)}
        isEquation={nav.unitPath ? nav.isEquation : isEquationFolder(editorContainerNode)}
        onModelChanged={reloadScopedModel}
        paperPath={nav.paperPath}
      />
    );
  }

  if (nav.sectionPath) {
    return (
      <SectionWorkspace
        sectionPath={nav.sectionPath}
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
