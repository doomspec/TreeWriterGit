import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { PaperWorkspace } from "@/components/editor/PaperWorkspace";
import { SectionWorkspace } from "@/components/editor/SectionWorkspace";
import { TableWorkspace } from "@/components/editor/TableWorkspace";
import { FolderBrowse } from "@/components/nav/FolderBrowse";
import { outlinePathFor, parentPath } from "@/lib/modelTree";
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider";

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
  const ws = useWorkspace();

  if (ws.paperWorkspacePath) {
    return (
      <PaperWorkspace
        paperPath={ws.paperWorkspacePath}
        refreshVersion={ws.refreshVersion}
        onNavigate={ws.navigateTo}
        onOpenFile={ws.openFile}
        onError={onError}
        dualPaneSplit={ws.dualPaneSplit}
        onDualPaneSplitChange={ws.setDualPaneSplit}
        paneView={ws.dualPaneView}
        onPaneViewChange={ws.setDualPaneView}
        activePane={ws.dualPaneActive}
        onActivePaneChange={ws.setDualPaneActive}
        onDispatchComplete={onDispatchComplete}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
      />
    );
  }

  if (ws.tablePath) {
    return (
      <TableWorkspace
        tablePath={ws.tablePath}
        tableTitle={ws.tableTitle}
        refreshVersion={ws.refreshVersion}
        onError={onError}
        onNavigate={ws.handleMarkdownNavigate}
        onDispatchComplete={onDispatchComplete}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
        onModelChanged={ws.reloadModel}
        paperPath={ws.paperPath}
        dualPaneSplit={ws.dualPaneSplit}
        onDualPaneSplitChange={ws.setDualPaneSplit}
      />
    );
  }

  if (ws.unitPath || ws.activeFile) {
    return (
      <EditorWorkspace
        unitPath={ws.unitPath}
        activeFile={ws.activeFile ?? (ws.unitPath ? outlinePathFor(ws.unitPath) : "")}
        refreshVersion={ws.refreshVersion}
        layout={ws.editorLayout}
        onLayoutChange={ws.setEditorLayout}
        onError={onError}
        linkContextPath={ws.unitPath ?? parentPath(ws.activeFile ?? "")}
        onNavigate={ws.handleMarkdownNavigate}
        dualPaneSplit={ws.dualPaneSplit}
        onDualPaneSplitChange={ws.setDualPaneSplit}
        assetPreviewSplit={ws.assetPreviewSplit}
        onAssetPreviewSplitChange={ws.setAssetPreviewSplit}
        paneView={ws.dualPaneView}
        onPaneViewChange={ws.setDualPaneView}
        activePane={ws.dualPaneActive}
        onActivePaneChange={ws.setDualPaneActive}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
        onDispatchComplete={onDispatchComplete}
        isFigure={ws.isFigure}
        isEquation={ws.isEquation}
        onModelChanged={ws.reloadModel}
        paperPath={ws.paperPath}
      />
    );
  }

  if (ws.sectionPath) {
    return (
      <SectionWorkspace
        sectionPath={ws.sectionPath}
        refreshVersion={ws.refreshVersion}
        onNavigate={ws.navigateTo}
        onOpenFile={ws.openFile}
        onError={onError}
        dualPaneSplit={ws.dualPaneSplit}
        onDualPaneSplitChange={ws.setDualPaneSplit}
        paneView={ws.dualPaneView}
        onPaneViewChange={ws.setDualPaneView}
        activePane={ws.dualPaneActive}
        onActivePaneChange={ws.setDualPaneActive}
        onDispatchComplete={onDispatchComplete}
      />
    );
  }

  return (
    <FolderBrowse
      tree={ws.tree}
      currentPath={ws.browsePath}
      onOpenFolder={ws.navigateTo}
      onOpenFile={ws.openFile}
      onChanged={ws.reloadModel}
      onError={onError}
      onSendToTerminal={onSendToTerminal}
      onNavigate={ws.handleMarkdownNavigate}
    />
  );
}
