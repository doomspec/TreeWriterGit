import { useCallback } from "react";

import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ComposedDraftEditor } from "@/components/editor/ComposedDraftEditor";
import {
  DualPanePane,
  shouldSyncDocumentOutline,
} from "@/components/editor/DualPaneController";
import { ManuscriptWorkspaceLayout } from "@/components/editor/workspace/ManuscriptWorkspaceLayout";
import { useManuscriptCompose } from "@/components/editor/workspace/useManuscriptCompose";
import { WorkspaceLoadingState } from "@/components/editor/workspace/WorkspaceLoadingState";
import { useReadingFocusSplitPaneTitles } from "@/components/editor/ReadingFocusNavBar";
import { SectionApproveChildrenButton } from "@/components/editor/SectionApproveChildrenButton";
import { outlinePathFor, tempNotesPathFor, type NavigateTarget } from "@/lib/modelTree";
import { normalizeComposedDraftBody } from "@/lib/sectionCompose";
import type { DualPaneActive, EditorVisiblePanes } from "@/lib/workspacePreferences";

export function PaperWorkspace({
  paperPath,
  refreshVersion,
  onNavigate,
  onOpenFile,
  onError,
  dualPaneSplit,
  onDualPaneSplitChange,
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  getPathVersion,
  notesSplitPercent,
  onNotesSplitChange,
  onDispatchComplete,
  onSendToTerminal,
  onBeforeDispatch,
}: {
  paperPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onError: (message: string) => void;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  getPathVersion: (path: string) => number;
  notesSplitPercent: number;
  onNotesSplitChange: (percent: number) => void;
  onDispatchComplete?: () => void;
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
}) {
  const { compose, loading, loadCompose } = useManuscriptCompose(paperPath, onError, refreshVersion);
  const showSplitPaneTitles = useReadingFocusSplitPaneTitles(visiblePanes);
  const outlinePath = outlinePathFor(paperPath);
  const notesPath = tempNotesPathFor(paperPath);

  const handleLinkNavigate = useCallback(
    (target: NavigateTarget) => {
      if (target.type === "file") {
        onOpenFile(target.path);
        return;
      }
      onNavigate(target.path);
    },
    [onNavigate, onOpenFile],
  );

  const handleChildrenApproved = useCallback(() => {
    void loadCompose(true);
    onDispatchComplete?.();
  }, [loadCompose, onDispatchComplete]);

  if (loading || !compose) {
    return (
      <WorkspaceLoadingState
        loading={loading}
        loadingMessage="Composing paper draft…"
        errorMessage="Could not load paper draft."
      />
    );
  }

  const outlinePane = (
    <DualPanePane
      pane="outline"
      activePane={activePane}
      onActivePaneChange={onActivePaneChange}
    >
      <MarkdownEditor
        key={outlinePath}
        filePath={outlinePath}
        refreshVersion={refreshVersion}
        layout="preview"
        compact
        splitPaneTitle={showSplitPaneTitles ? "Outline" : undefined}
        syncDocumentOutline={shouldSyncDocumentOutline(visiblePanes, "outline")}
        paneLabel="Paper outline"
        defaultPaneMode="rendered"
        className="min-h-0 flex-1"
        onError={onError}
        linkContextPath={paperPath}
        onNavigate={handleLinkNavigate}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
        onDispatchComplete={() => {
          void loadCompose(true);
          onDispatchComplete?.();
        }}
        paperPath={paperPath}
        enableDispatch={false}
        showReadingFocusBar={activePane === "outline"}
      />
    </DualPanePane>
  );

  const draftPane = (
    <DualPanePane
      pane="draft"
      activePane={activePane}
      onActivePaneChange={onActivePaneChange}
    >
      <ComposedDraftEditor
        containerPath={paperPath}
        title={compose.title}
        markdown={normalizeComposedDraftBody(
          compose.draftMarkdown.replace(/^#\s+.+\n+/, ""),
          compose.title,
        )}
        approvedDraftMarkdown={compose.approvedDraftMarkdown}
        pendingAiProvider={compose.pendingAiProvider ?? null}
        refreshVersion={refreshVersion}
        splitPaneTitle={showSplitPaneTitles ? "Draft" : undefined}
        syncDocumentOutline={shouldSyncDocumentOutline(visiblePanes, "draft")}
        linkContextPath={paperPath}
        onNavigate={handleLinkNavigate}
        onError={onError}
        onSynced={() => {
          void loadCompose(true);
          onDispatchComplete?.();
        }}
        paneLabel="Paper draft"
        subtitle="Composed from sections · edits sync to units"
        childrenApprovalExtra={
          <SectionApproveChildrenButton
            sectionPath={paperPath}
            inline
            onApproved={handleChildrenApproved}
            onError={onError}
          />
        }
        showReadingFocusBar={activePane === "draft"}
      />
    </DualPanePane>
  );

  const notesPane = (
    <DualPanePane pane="notes" activePane={activePane} onActivePaneChange={onActivePaneChange}>
      <MarkdownEditor
        key={notesPath}
        filePath={notesPath}
        refreshVersion={refreshVersion}
        pathVersion={getPathVersion(notesPath)}
        layout="preview"
        compact
        splitPaneTitle={showSplitPaneTitles ? "Notes" : undefined}
        paneLabel="Notes"
        defaultPaneMode="rendered"
        className="min-h-0 flex-1"
        onError={onError}
        linkContextPath={paperPath}
        onNavigate={handleLinkNavigate}
        paperPath={paperPath}
        enableDispatch={false}
        showReadingFocusBar={activePane === "notes"}
      />
    </DualPanePane>
  );

  return (
    <ManuscriptWorkspaceLayout
      dualPaneSplit={dualPaneSplit}
      onDualPaneSplitChange={onDualPaneSplitChange}
      visiblePanes={visiblePanes}
      onVisiblePanesChange={onVisiblePanesChange}
      activePane={activePane}
      onActivePaneChange={onActivePaneChange}
      notesSplitPercent={notesSplitPercent}
      onNotesSplitChange={onNotesSplitChange}
      outlinePane={outlinePane}
      draftPane={draftPane}
      notesPane={notesPane}
    />
  );
}
