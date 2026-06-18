import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { TableBuilderEditor } from "@/components/editor/TableBuilderEditor";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";

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
}) {
  const outlinePath = outlinePathFor(tablePath);
  const draftPath = `${tablePath}/draft.md`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResizableDualPane
        splitPercent={dualPaneSplit}
        onSplitChange={onDualPaneSplitChange}
        left={
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
        }
        right={
          <TableBuilderEditor
            key={draftPath}
            filePath={draftPath}
            tableTitle={tableTitle}
            refreshVersion={refreshVersion}
            onError={onError}
            onModelChanged={onModelChanged}
            className="min-h-0 flex-1"
          />
        }
      />
    </div>
  );
}
