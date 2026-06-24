import { useCallback, useEffect, useRef, useState } from "react";

import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ComposedDraftEditor } from "@/components/editor/ComposedDraftEditor";
import {
  ReadingFocusExtra,
  useReadingFocusSplitPaneTitles,
} from "@/components/editor/ReadingFocusNavBar";
import { SectionApproveChildrenButton } from "@/components/editor/SectionApproveChildrenButton";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";
import { normalizeComposedDraftBody } from "@/lib/sectionCompose";
import { useReadingFocus } from "@/lib/readingFocus";
import type { DualPaneActive, DualPaneView } from "@/lib/workspacePreferences";
import { fetchSectionCompose } from "@/modelApi";

export function PaperWorkspace({
  paperPath,
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
  paneView: DualPaneView;
  onPaneViewChange: (view: DualPaneView) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  onDispatchComplete?: () => void;
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
}) {
  const [compose, setCompose] = useState<Awaited<ReturnType<typeof fetchSectionCompose>> | null>(null);
  const [loading, setLoading] = useState(true);
  const hasComposeRef = useRef(false);
  const readingFocus = useReadingFocus();
  const showSplitPaneTitles = useReadingFocusSplitPaneTitles(paneView);
  const outlinePath = outlinePathFor(paperPath);

  const loadCompose = useCallback(
    (background = false) => {
      if (!background) setLoading(true);
      return fetchSectionCompose(paperPath)
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
    [onError, paperPath],
  );

  useEffect(() => {
    hasComposeRef.current = false;
    setCompose(null);
    setLoading(true);
  }, [paperPath]);

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

  const handleChildrenApproved = useCallback(() => {
    void loadCompose(true);
    onDispatchComplete?.();
  }, [loadCompose, onDispatchComplete]);

  if (loading || !compose) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {loading ? "Composing paper draft…" : "Could not load paper draft."}
      </div>
    );
  }

  const outlinePane = (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      tabIndex={-1}
      onFocusCapture={() => onActivePaneChange("outline")}
      onMouseDown={() => onActivePaneChange("outline")}
    >
      <MarkdownEditor
        key={outlinePath}
        filePath={outlinePath}
        refreshVersion={refreshVersion}
        layout="preview"
        compact
        showFocusGraph
        splitPaneTitle={showSplitPaneTitles ? "Outline" : undefined}
        syncDocumentOutline={
          paneView === "outline" || (paneView === "split" && activePane === "outline")
        }
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
        showFocusGraph={paneView === "draft"}
        splitPaneTitle={showSplitPaneTitles ? "Draft" : undefined}
        syncDocumentOutline={
          paneView === "draft" || (paneView === "split" && activePane === "draft")
        }
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
      />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
