import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import {
  DualPaneController,
  DualPanePane,
} from "@/components/editor/DualPaneController";
import { TableBuilderEditor } from "@/components/editor/TableBuilderEditor";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";
import type { DualPaneActive, EditorVisiblePanes } from "@/lib/workspacePreferences";

export function TableWorkspace({
  tablePath,
  tableTitle,
  refreshVersion,
  onError,
  onNavigate,
  onDispatchComplete,
  onSendToTerminal,
  onBeforeDispatch,
  onModelChanged,
  paperPath,
  dualPaneSplit,
  onDualPaneSplitChange,
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
}: {
  tablePath: string;
  tableTitle: string;
  refreshVersion: number;
  onError: (message: string) => void;
  onNavigate?: (target: NavigateTarget) => void;
  onDispatchComplete?: () => void;
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
  onModelChanged?: () => void;
  paperPath?: string | null;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  notesSplitPercent?: number;
  onNotesSplitChange?: (percent: number) => void;
}) {
  const outlinePath = outlinePathFor(tablePath);
  const draftPath = `${tablePath}/draft.md`;

  const outlinePane = (
    <DualPanePane pane="outline" activePane={activePane} onActivePaneChange={onActivePaneChange}>
      <MarkdownEditor
        key={outlinePath}
        filePath={outlinePath}
        refreshVersion={refreshVersion}
        layout="preview"
        compact
        paneLabel="Outline"
        defaultPaneMode="rendered"
        className="min-h-0 flex-1"
        onError={onError}
        linkContextPath={tablePath}
        onNavigate={onNavigate}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
        onDispatchComplete={onDispatchComplete}
        paperPath={paperPath}
      />
    </DualPanePane>
  );

  const draftPane = (
    <DualPanePane pane="draft" activePane={activePane} onActivePaneChange={onActivePaneChange}>
      <TableBuilderEditor
        key={draftPath}
        filePath={draftPath}
        tableTitle={tableTitle}
        refreshVersion={refreshVersion}
        onError={onError}
        onModelChanged={onModelChanged}
        className="min-h-0 flex-1"
      />
    </DualPanePane>
  );

  return (
    <DualPaneController
      splitPercent={dualPaneSplit}
      onSplitChange={onDualPaneSplitChange}
      visiblePanes={visiblePanes}
      onVisiblePanesChange={onVisiblePanesChange}
      activePane={activePane}
      onActivePaneChange={onActivePaneChange}
      outlinePane={outlinePane}
      draftPane={draftPane}
    />
  );
}
