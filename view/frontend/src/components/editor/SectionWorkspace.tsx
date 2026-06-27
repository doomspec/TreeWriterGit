import { useCallback, useEffect, useRef, useState } from "react";

import { ComposedDraftEditor } from "@/components/editor/ComposedDraftEditor";
import { DispatchAiButton } from "@/components/editor/DispatchAiButton";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import {
  DualPaneController,
  DualPanePane,
  shouldSyncDocumentOutline,
} from "@/components/editor/DualPaneController";
import { SectionApproveChildrenButton } from "@/components/editor/SectionApproveChildrenButton";
import { SectionUnapprovedStatusBanner } from "@/components/editor/SectionUnapprovedStatusBanner";
import { useReadingFocusSplitPaneTitles } from "@/components/editor/ReadingFocusNavBar";
import {
  dispatchActionForSectionPane,
  dispatchActionLabel,
  isDispatchRunShortcut,
} from "@/lib/agentDispatchClient";
import { paperPathFromModelPath } from "@/lib/assetInsert";
import { useAgentDispatchPanelOptional } from "@/lib/agentDispatchPanel";
import { useDispatchJob } from "@/lib/useDispatchJob";
import { outlinePathFor, tempNotesPathFor, type NavigateTarget } from "@/lib/modelTree";
import { paperSlugFromSectionPath, refreshPaperPendingPaths } from "@/lib/refreshPaperPending";
import { usePaperDetail } from "@/lib/usePaperDetail";
import type { DualPaneActive, EditorVisiblePanes } from "@/lib/workspacePreferences";
import { fetchSectionCompose } from "@/modelApi";

type SectionCompose = Awaited<ReturnType<typeof fetchSectionCompose>>;

export function SectionWorkspace({
  sectionPath,
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
}: {
  sectionPath: string;
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
}) {
  const [compose, setCompose] = useState<SectionCompose | null>(null);
  const [loading, setLoading] = useState(true);
  const hasComposeRef = useRef(false);
  const outlineDispatch = useDispatchJob({
    scope: "section",
    targetPath: sectionPath,
    pane: "outline",
    onResumeComplete: onDispatchComplete,
    onError,
  });
  const draftDispatch = useDispatchJob({
    scope: "section",
    targetPath: sectionPath,
    pane: "draft",
    onResumeComplete: onDispatchComplete,
    onError,
  });
  const {
    progress: outlineProgress,
    dispatching: outlineDispatching,
    runSectionDispatch: runOutlineDispatch,
  } = outlineDispatch;
  const {
    progress: draftProgress,
    dispatching: draftDispatching,
    runSectionFanOut: runDraftFanOut,
  } = draftDispatch;
  const dispatching = outlineDispatching || draftDispatching;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const showSplitPaneTitles = useReadingFocusSplitPaneTitles(visiblePanes);
  const agentDispatchPanel = useAgentDispatchPanelOptional();
  const paperSlug = paperSlugFromSectionPath(sectionPath);
  const { detail: paperDetail } = usePaperDetail(paperSlug, refreshVersion, onError);
  const sectionCounts = paperDetail?.containerCounts?.[sectionPath];

  useEffect(() => {
    void refreshPaperPendingPaths(sectionPath);
  }, [refreshVersion, sectionPath]);

  const loadCompose = useCallback(
    (background = false) => {
      if (!background) setLoading(true);
      return fetchSectionCompose(sectionPath)
        .then((data) => {
          setCompose(data);
          hasComposeRef.current = true;
          setLoading(false);
        })
        .catch((err) => {
          if (!hasComposeRef.current) setCompose(null);
          setLoading(false);
          onError(err instanceof Error ? err.message : String(err));
        });
    },
    [onError, sectionPath],
  );

  useEffect(() => {
    hasComposeRef.current = false;
    setCompose(null);
    setLoading(true);
  }, [sectionPath]);

  useEffect(() => {
    let cancelled = false;
    void loadCompose(hasComposeRef.current).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadCompose, refreshVersion]);

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

  const handleFanOut = useCallback(
    async (pane: "outline" | "draft") => {
      onActivePaneChange(pane);
      const action = dispatchActionForSectionPane(pane);
      try {
        if (pane === "outline") {
          await runOutlineDispatch({
            sectionPath,
            action,
          });
        } else {
          const count = await runDraftFanOut({
            sectionPath,
            action,
          });
          if (count === 0) {
            onError("No units found under this section");
            return;
          }
        }
        await loadCompose(true);
        onDispatchComplete?.();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [loadCompose, onActivePaneChange, onDispatchComplete, onError, runDraftFanOut, runOutlineDispatch, sectionPath],
  );

  const handleOpenAiDispatch = useCallback(
    (pane: "outline" | "draft") => {
      onActivePaneChange(pane);
      const action = dispatchActionForSectionPane(pane);
      agentDispatchPanel?.openDispatch({
        action,
        pane,
        autoPreview: true,
      });
    },
    [agentDispatchPanel, onActivePaneChange],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isDispatchRunShortcut(event)) return;
      if (!containerRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      if (activePane === "notes") return;
      agentDispatchPanel?.openDispatch({
        action: dispatchActionForSectionPane(activePane),
        pane: activePane,
        autoPreview: true,
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePane, agentDispatchPanel]);

  const handleChildrenApproved = useCallback(() => {
    void refreshPaperPendingPaths(sectionPath);
    void loadCompose(true);
    onDispatchComplete?.();
  }, [loadCompose, onDispatchComplete, sectionPath]);

  const outlinePath = outlinePathFor(sectionPath);
  const notesPath = tempNotesPathFor(sectionPath);
  const paperPath = paperPathFromModelPath(outlinePath);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Composing section view…
      </div>
    );
  }

  if (!compose) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Could not load section view.
      </div>
    );
  }

  const aiButton = (pane: "outline" | "draft") => (
    <DispatchAiButton
      actionLabel={dispatchActionLabel(dispatchActionForSectionPane(pane))}
      dispatching={pane === "outline" ? outlineDispatching : draftDispatching}
      progress={pane === "outline" ? outlineProgress : draftProgress}
      disabled={dispatching}
      onClick={() => handleOpenAiDispatch(pane)}
    />
  );

  const approveChildrenButton = (
    <>
      <SectionUnapprovedStatusBanner sectionPath={sectionPath} counts={sectionCounts} />
      <SectionApproveChildrenButton
        sectionPath={sectionPath}
        disabled={dispatching}
        inline
        onApproved={handleChildrenApproved}
        onError={onError}
      />
    </>
  );

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
        syncDocumentOutline={shouldSyncDocumentOutline(visiblePanes, activePane)}
        paneLabel="Outline"
        defaultPaneMode="rendered"
        className="min-h-0 flex-1"
        onError={onError}
        linkContextPath={sectionPath}
        onNavigate={handleLinkNavigate}
        onDispatchComplete={() => {
          void loadCompose(true);
          onDispatchComplete?.();
        }}
        paperPath={paperPath}
        enableDispatch={false}
        headerExtra={aiButton("outline")}
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
        containerPath={sectionPath}
        title={compose.title}
        markdown={compose.draftMarkdown}
        approvedDraftMarkdown={compose.approvedDraftMarkdown}
        pendingAiProvider={compose.pendingAiProvider ?? null}
        refreshVersion={refreshVersion}
        splitPaneTitle={showSplitPaneTitles ? "Draft" : undefined}
        syncDocumentOutline={shouldSyncDocumentOutline(visiblePanes, activePane)}
        linkContextPath={sectionPath}
        onNavigate={handleLinkNavigate}
        onError={onError}
        onSynced={() => {
          void loadCompose(true);
          onDispatchComplete?.();
        }}
        paneLabel="Draft"
        headerExtra={aiButton("draft")}
        childrenApprovalExtra={approveChildrenButton}
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
        linkContextPath={sectionPath}
        onNavigate={handleLinkNavigate}
        paperPath={paperPath}
        enableDispatch={false}
        showReadingFocusBar={activePane === "notes"}
      />
    </DualPanePane>
  );

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <DualPaneController
        splitPercent={dualPaneSplit}
        onSplitChange={onDualPaneSplitChange}
        visiblePanes={visiblePanes}
        onVisiblePanesChange={onVisiblePanesChange}
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
        outlinePane={outlinePane}
        draftPane={draftPane}
        notesPane={notesPane}
        notesSplitPercent={notesSplitPercent}
        onNotesSplitChange={onNotesSplitChange}
      />
    </div>
  );
}
