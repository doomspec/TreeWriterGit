import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Columns2, Eye, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FigurePreviewPanel } from "@/components/editor/FigurePreviewPanel";
import { EquationPreviewPanel } from "@/components/editor/EquationPreviewPanel";
import { MarkdownEditor, type EditorLayout } from "@/components/editor/MarkdownEditor";
import {
  ReadingFocusExtra,
  useReadingFocusSplitPaneTitles,
} from "@/components/editor/ReadingFocusNavBar";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { ResizableVerticalSplit } from "@/components/layout/ResizableVerticalSplit";
import { outlinePathFor, stripFrontmatter, type NavigateTarget } from "@/lib/modelTree";
import { useReadingFocus } from "@/lib/readingFocus";
import type { DualPaneActive, DualPaneView } from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

function captionFromDraft(content: string): string {
  return stripFrontmatter(content)
    .replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "")
    .trim();
}

function LeafUnitEditor({
  unitPath,
  outlinePath,
  draftPath,
  refreshVersion,
  isFigure,
  isEquation,
  isPaperEditor,
  paperPath,
  linkContextPath,
  onError,
  onNavigate,
  onSendToTerminal,
  onBeforeDispatch,
  onDispatchComplete,
  onModelChanged,
  dualPaneSplit,
  onDualPaneSplitChange,
  assetPreviewSplit,
  onAssetPreviewSplitChange,
  paneView,
  onPaneViewChange,
  onActivePaneChange,
}: {
  unitPath: string;
  outlinePath: string;
  draftPath: string;
  refreshVersion: number;
  isFigure: boolean;
  isEquation: boolean;
  isPaperEditor: boolean;
  paperPath: string | null;
  linkContextPath: string;
  onError: (message: string) => void;
  onNavigate?: (target: NavigateTarget) => void;
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
  onDispatchComplete?: () => void;
  onModelChanged?: () => void;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  assetPreviewSplit: number;
  onAssetPreviewSplitChange: (percent: number) => void;
  paneView: DualPaneView;
  onPaneViewChange: (view: DualPaneView) => void;
  onActivePaneChange: (pane: DualPaneActive) => void;
}) {
  const [liveDraftCaption, setLiveDraftCaption] = useState<string | null>(null);
  const liveCaptionTimerRef = useRef<number | null>(null);
  const readingFocus = useReadingFocus();
  const showSplitPaneTitles = useReadingFocusSplitPaneTitles(paneView);

  const handleDraftContentChange = useCallback(
    (content: string) => {
      if (!isFigure && !isEquation) return;
      const nextCaption = captionFromDraft(content);
      if (liveCaptionTimerRef.current !== null) {
        window.clearTimeout(liveCaptionTimerRef.current);
      }
      liveCaptionTimerRef.current = window.setTimeout(() => {
        startTransition(() => {
          setLiveDraftCaption(nextCaption);
        });
      }, 120);
    },
    [isEquation, isFigure],
  );

  useEffect(() => {
    return () => {
      if (liveCaptionTimerRef.current !== null) {
        window.clearTimeout(liveCaptionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (liveCaptionTimerRef.current !== null) {
      window.clearTimeout(liveCaptionTimerRef.current);
      liveCaptionTimerRef.current = null;
    }
    setLiveDraftCaption(null);
  }, [unitPath, refreshVersion]);

  const outlinePane = useMemo(
    () => (
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
          paneLabel={isPaperEditor ? "Paper outline" : "Outline"}
          defaultPaneMode="rendered"
          className="min-h-0 flex-1"
          isFigureUnit={isFigure}
          onError={onError}
          linkContextPath={linkContextPath}
          onNavigate={onNavigate}
          onSendToTerminal={onSendToTerminal}
          onBeforeDispatch={onBeforeDispatch}
          onDispatchComplete={onDispatchComplete}
          paperPath={paperPath}
        />
      </div>
    ),
    [
      isPaperEditor,
      isFigure,
      linkContextPath,
      onActivePaneChange,
      onBeforeDispatch,
      onDispatchComplete,
      onError,
      onNavigate,
      onSendToTerminal,
      outlinePath,
      paperPath,
      refreshVersion,
      showSplitPaneTitles,
    ],
  );

  const draftPane = useMemo(
    () => (
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        tabIndex={-1}
        onFocusCapture={() => onActivePaneChange("draft")}
        onMouseDown={() => onActivePaneChange("draft")}
      >
        <MarkdownEditor
          key={draftPath}
          filePath={draftPath}
          refreshVersion={refreshVersion}
          layout="preview"
          compact
          showFocusGraph={paneView === "draft"}
          splitPaneTitle={showSplitPaneTitles ? "Draft" : undefined}
          paneLabel={isPaperEditor ? "Paper draft" : "Draft"}
          defaultPaneMode="rendered"
          className="min-h-0 flex-1"
          isFigureUnit={isFigure}
          onError={onError}
          linkContextPath={linkContextPath}
          onNavigate={onNavigate}
          onSendToTerminal={onSendToTerminal}
          onBeforeDispatch={onBeforeDispatch}
          onDispatchComplete={onDispatchComplete}
          onContentChange={isFigure || isEquation ? handleDraftContentChange : undefined}
          paperPath={paperPath}
        />
      </div>
    ),
    [
      draftPath,
      handleDraftContentChange,
      isEquation,
      isFigure,
      isPaperEditor,
      linkContextPath,
      onActivePaneChange,
      onBeforeDispatch,
      onDispatchComplete,
      onError,
      onNavigate,
      onSendToTerminal,
      paneView,
      paperPath,
      refreshVersion,
      showSplitPaneTitles,
    ],
  );

  const editorDualPane = useMemo(
    () =>
      readingFocus.active ? (
        paneView === "split" ? (
          <ResizableDualPane
            className="reading-focus-dual-pane min-h-0 flex-1"
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
          className="min-h-0 flex-1"
          splitPercent={dualPaneSplit}
          onSplitChange={onDualPaneSplitChange}
          left={outlinePane}
          right={draftPane}
        />
      ),
    [
      draftPane,
      dualPaneSplit,
      onDualPaneSplitChange,
      outlinePane,
      paneView,
      readingFocus.active,
    ],
  );

  const assetPreview = useMemo(() => {
    if (isFigure) {
      return (
        <FigurePreviewPanel
          unitPath={unitPath}
          refreshVersion={refreshVersion}
          liveCaption={liveDraftCaption}
          embeddedInEditor
          onModelChanged={onModelChanged}
          onError={onError}
        />
      );
    }
    if (isEquation) {
      return (
        <EquationPreviewPanel
          unitPath={unitPath}
          refreshVersion={refreshVersion}
          liveCaption={liveDraftCaption}
          onModelChanged={onModelChanged}
          onError={onError}
        />
      );
    }
    return null;
  }, [
    isEquation,
    isFigure,
    liveDraftCaption,
    onError,
    onModelChanged,
    refreshVersion,
    unitPath,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReadingFocusExtra focusedPane={paneView} onPaneChange={onPaneViewChange} />
      {assetPreview && !readingFocus.active ? (
        <ResizableVerticalSplit
          className="min-h-0 flex-1"
          splitPercent={assetPreviewSplit}
          onSplitChange={onAssetPreviewSplitChange}
          handleLabel="Resize outline/draft and figure preview"
          top={editorDualPane}
          bottom={assetPreview}
        />
      ) : (
        editorDualPane
      )}
    </div>
  );
}

export function EditorWorkspace({
  unitPath,
  activeFile,
  refreshVersion,
  layout,
  onLayoutChange,
  onError,
  linkContextPath = "",
  onNavigate,
  dualPaneSplit,
  onDualPaneSplitChange,
  assetPreviewSplit,
  onAssetPreviewSplitChange,
  paneView,
  onPaneViewChange,
  activePane,
  onActivePaneChange,
  onSendToTerminal,
  onBeforeDispatch,
  onDispatchComplete,
  isFigure = false,
  isEquation = false,
  onModelChanged,
  paperPath = null,
}: {
  unitPath: string | null;
  activeFile: string;
  refreshVersion: number;
  layout: EditorLayout;
  onLayoutChange: (layout: EditorLayout) => void;
  onError: (message: string) => void;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  assetPreviewSplit: number;
  onAssetPreviewSplitChange: (percent: number) => void;
  paneView: DualPaneView;
  onPaneViewChange: (view: DualPaneView) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
  onDispatchComplete?: () => void;
  isFigure?: boolean;
  isEquation?: boolean;
  onModelChanged?: () => void;
  paperPath?: string | null;
}) {
  const isLeafEditor = Boolean(unitPath);
  const outlinePath = unitPath ? outlinePathFor(unitPath) : null;
  const draftPath = unitPath ? `${unitPath}/draft.md` : null;
  const readingFocus = useReadingFocus();

  const layoutButtons: { id: EditorLayout; icon: typeof FileCode2; label: string }[] = [
    { id: "source", icon: FileCode2, label: "Source" },
    { id: "split", icon: Columns2, label: "Split" },
    { id: "preview", icon: Eye, label: "Preview" },
  ];

  const isPaperEditor = Boolean(paperPath && unitPath === paperPath);

  if (isLeafEditor && outlinePath && draftPath && unitPath) {
    return (
      <LeafUnitEditor
        unitPath={unitPath}
        outlinePath={outlinePath}
        draftPath={draftPath}
        refreshVersion={refreshVersion}
        isFigure={isFigure}
        isEquation={isEquation}
        isPaperEditor={isPaperEditor}
        paperPath={paperPath}
        linkContextPath={linkContextPath}
        onError={onError}
        onNavigate={onNavigate}
        onSendToTerminal={onSendToTerminal}
        onBeforeDispatch={onBeforeDispatch}
        onDispatchComplete={onDispatchComplete}
        onModelChanged={onModelChanged}
        dualPaneSplit={dualPaneSplit}
        onDualPaneSplitChange={onDualPaneSplitChange}
        assetPreviewSplit={assetPreviewSplit}
        onAssetPreviewSplitChange={onAssetPreviewSplitChange}
        paneView={paneView}
        onPaneViewChange={onPaneViewChange}
        onActivePaneChange={onActivePaneChange}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex h-10 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-3",
          readingFocus.active && "editor-chrome-hidden",
        )}
      >
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {layoutButtons.map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              type="button"
              variant={layout === id ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              aria-label={label}
              title={label}
              onClick={() => onLayoutChange(id)}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>

      <MarkdownEditor
        key={activeFile}
        filePath={activeFile}
        refreshVersion={refreshVersion}
        layout={layout}
        className="min-h-0 flex-1"
        syncDocumentOutline
        onError={onError}
        linkContextPath={linkContextPath}
        onNavigate={onNavigate}
        splitPercent={dualPaneSplit}
        onSplitChange={onDualPaneSplitChange}
        paperPath={paperPath}
      />
    </div>
  );
}
