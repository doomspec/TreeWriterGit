import { useCallback, useEffect, useRef, useState } from "react";

import { ComposedDraftEditor } from "@/components/editor/ComposedDraftEditor";
import { DispatchAiButton } from "@/components/editor/DispatchAiButton";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { SectionApproveChildrenButton } from "@/components/editor/SectionApproveChildrenButton";
import {
  ReadingFocusExtra,
  ReadingFocusSplitPaneTitle,
  useReadingFocusSplitPaneTitles,
} from "@/components/editor/ReadingFocusNavBar";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import {
  dispatchActionForSectionPane,
  dispatchActionLabel,
  isDispatchRunShortcut,
} from "@/lib/agentDispatchClient";
import { paperPathFromModelPath } from "@/lib/assetInsert";
import { useAgentDispatchPanelOptional } from "@/lib/agentDispatchPanel";
import { useDispatchJob } from "@/lib/useDispatchJob";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";
import { useReadingFocus } from "@/lib/readingFocus";
import type { DualPaneActive, DualPaneView } from "@/lib/workspacePreferences";
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
  paneView,
  onPaneViewChange,
  activePane,
  onActivePaneChange,
  onDispatchComplete,
}: {
  sectionPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onError: (message: string) => void;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  paneView: DualPaneView;
  onPaneViewChange: (view: DualPaneView) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
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
  const readingFocus = useReadingFocus();
  const showSplitPaneTitles = useReadingFocusSplitPaneTitles(paneView);
  const agentDispatchPanel = useAgentDispatchPanelOptional();

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
      const pane = activePane;
      agentDispatchPanel?.openDispatch({
        action: dispatchActionForSectionPane(pane),
        pane,
        autoPreview: true,
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePane, agentDispatchPanel]);

  const handleChildrenApproved = useCallback(() => {
    void loadCompose(true);
    onDispatchComplete?.();
  }, [loadCompose, onDispatchComplete]);

  const outlinePath = outlinePathFor(sectionPath);
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
    <SectionApproveChildrenButton
      sectionPath={sectionPath}
      disabled={dispatching}
      inline
      onApproved={handleChildrenApproved}
      onError={onError}
    />
  );

  const outlinePane = (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      tabIndex={-1}
      onFocusCapture={() => onActivePaneChange("outline")}
      onMouseDown={() => onActivePaneChange("outline")}
    >
      {showSplitPaneTitles ? <ReadingFocusSplitPaneTitle label="Outline" /> : null}
      <MarkdownEditor
        key={outlinePath}
        filePath={outlinePath}
        refreshVersion={refreshVersion}
        layout="preview"
        compact
        showFocusGraph
        syncDocumentOutline={
          paneView === "outline" || (paneView === "split" && activePane === "outline")
        }
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
      />
    </div>
  );

  const draftPane = (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      tabIndex={-1}
      onFocusCapture={() => onActivePaneChange("draft")}
      onMouseDown={() => onActivePaneChange("draft")}
    >
      {showSplitPaneTitles ? <ReadingFocusSplitPaneTitle label="Draft" /> : null}
      <ComposedDraftEditor
        containerPath={sectionPath}
        title={compose.title}
        markdown={compose.draftMarkdown}
        approvedDraftMarkdown={compose.approvedDraftMarkdown}
        pendingAiProvider={compose.pendingAiProvider ?? null}
        refreshVersion={refreshVersion}
        showFocusGraph={paneView === "draft"}
        syncDocumentOutline={
          paneView === "draft" || (paneView === "split" && activePane === "draft")
        }
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
      />
    </div>
  );

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <ReadingFocusExtra focusedPane={paneView} onPaneChange={onPaneViewChange} />
      {readingFocus.active ? (
        paneView === "split" ? (
          <ResizableDualPane
            className="reading-focus-dual-pane"
            splitPercent={dualPaneSplit}
            onSplitChange={onDualPaneSplitChange}
            left={outlinePane}
            right={draftPane}
          />
        ) : paneView === "outline" ? (
          outlinePane
        ) : (
          draftPane
        )
      ) : (
        <ResizableDualPane
          splitPercent={dualPaneSplit}
          onSplitChange={onDualPaneSplitChange}
          left={outlinePane}
          right={draftPane}
        />
      )}
    </div>
  );
}
