import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Columns2, Eye, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BibEntrySourcePane } from "@/components/editor/BibEntrySourcePane";
import { BibFilePreview } from "@/components/editor/BibFilePreview";
import { FigurePreviewPanel } from "@/components/editor/FigurePreviewPanel";
import { EquationPreviewPanel } from "@/components/editor/EquationPreviewPanel";
import { MarkdownEditor, type EditorLayout } from "@/components/editor/MarkdownEditor";
import {
  DualPaneController,
  DualPanePane,
} from "@/components/editor/DualPaneController";
import { useReadingFocusSplitPaneTitles } from "@/components/editor/ReadingFocusNavBar";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { ResizableVerticalSplit } from "@/components/layout/ResizableVerticalSplit";
import { outlinePathFor, stripFrontmatter, tempNotesPathFor, draftPathFor, type NavigateTarget } from "@/lib/modelTree";
import { useReadingFocus } from "@/lib/readingFocus";
import { useBibLibrarySummary } from "@/lib/bibLibraryContext";
import { useWindowWidth } from "@/lib/useWindowWidth";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import type { DualPaneActive, EditorVisiblePanes } from "@/lib/workspacePreferences";
import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  scheduleSaveWorkspacePreferences,
} from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

function captionFromDraft(content: string): string {
  return stripFrontmatter(content)
    .replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "")
    .trim();
}

function BibMainBibWorkspace({
  activeFile,
  refreshVersion,
  getPathVersion,
  layout,
  onLayoutChange,
  editorChrome,
  dualPaneSplit,
  onDualPaneSplitChange,
  onError,
  linkContextPath,
  onNavigate,
  onModelChanged,
  paperPath,
  layoutToggleButtons,
}: {
  activeFile: string;
  refreshVersion: number;
  getPathVersion: (path: string) => number;
  layout: EditorLayout;
  onLayoutChange: (layout: EditorLayout) => void;
  editorChrome: React.ReactNode;
  layoutToggleButtons: React.ReactNode;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  onError: (message: string) => void;
  linkContextPath: string;
  onNavigate?: (target: NavigateTarget) => void;
  onModelChanged?: () => void;
  paperPath?: string | null;
}) {
  const nav = useWorkspaceNavigationContext();
  const windowWidth = useWindowWidth();
  const { summary } = useBibLibrarySummary();
  const loadFullBibPref = mergeWorkspaceDefaults(loadWorkspacePreferences()).loadLargeBibSource;
  const [fullSourceOptIn, setFullSourceOptIn] = useState(() => loadFullBibPref);
  // References sidebar shows a LIST of many entries; BibFilePreview's own
  // entry list would be redundant alongside it, so hide that one.
  const hideEntryList = nav.sidebarPanel === "references" && nav.sidebarPanelOpen;

  const showFullSource = layout === "source" || fullSourceOptIn;
  /**
   * The raw-source pane shows ONE entry's BibTeX text — not a list, so it's
   * not redundant with the references sidebar and clicking a reference
   * there should still show it alongside the verification form. Only hide
   * it when there's genuinely no room (narrow layout).
   */
  const hideBibSourcePane = layout !== "source" && windowWidth < 1280;

  const handleLoadFullSource = useCallback(() => {
    setFullSourceOptIn(true);
    scheduleSaveWorkspacePreferences({ loadLargeBibSource: true });
  }, []);

  const handleBackToEntryView = useCallback(() => {
    setFullSourceOptIn(false);
    scheduleSaveWorkspacePreferences({ loadLargeBibSource: false });
    if (layout === "source") onLayoutChange("split");
  }, [layout, onLayoutChange]);

  const fullSourceEditor = (
    <MarkdownEditor
      key={`${activeFile}:source`}
      filePath={activeFile}
      refreshVersion={refreshVersion}
      pathVersion={getPathVersion(activeFile)}
      layout="source"
      className="min-h-0 min-w-0 flex-1"
      onError={onError}
      linkContextPath={linkContextPath}
      onNavigate={onNavigate}
      splitPercent={dualPaneSplit}
      onSplitChange={onDualPaneSplitChange}
      paperPath={paperPath}
      enableDispatch={false}
      scrollToBibCiteKey={nav.selectedBibCiteKey}
    />
  );

  const splitWithSource = layout === "split" && !hideBibSourcePane;

  const sourcePane = showFullSource ? (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="ui-pane-header shrink-0">
        <span className="ui-pane-header__label">Full main.bib</span>
        <div className="ui-pane-header__actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleBackToEntryView}
          >
            Back to entry view
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{fullSourceEditor}</div>
    </div>
  ) : (
    <BibEntrySourcePane
      citeKey={nav.selectedBibCiteKey}
      totalEntries={summary?.total}
      onLoadFullSource={handleLoadFullSource}
    />
  );

  const previewPane = (
    <BibFilePreview
      key={`${activeFile}:preview`}
      filePath={activeFile}
      onError={onError}
      onModelChanged={onModelChanged}
      paperPath={paperPath}
      hideEntryList={hideEntryList}
      headerActions={splitWithSource ? layoutToggleButtons : undefined}
    />
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {!splitWithSource ? editorChrome : null}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {layout === "source" ? (
          sourcePane
        ) : splitWithSource ? (
          <ResizableDualPane
            splitPercent={dualPaneSplit}
            onSplitChange={onDualPaneSplitChange}
            className="min-h-0 min-w-0 flex-1"
            left={previewPane}
            right={sourcePane}
          />
        ) : (
          previewPane
        )}
      </div>
    </div>
  );
}

function LeafUnitEditor({
  unitPath,
  outlinePath,
  draftPath,
  refreshVersion,
  getPathVersion,
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
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  notesSplitPercent,
  onNotesSplitChange,
}: {
  unitPath: string;
  outlinePath: string;
  draftPath: string;
  refreshVersion: number;
  getPathVersion: (path: string) => number;
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
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  notesSplitPercent: number;
  onNotesSplitChange: (percent: number) => void;
}) {
  const notesPath = !isFigure && !isEquation ? tempNotesPathFor(unitPath) : null;
  const [liveDraftCaption, setLiveDraftCaption] = useState<string | null>(null);
  const liveCaptionTimerRef = useRef<number | null>(null);
  const readingFocus = useReadingFocus();
  const showSplitPaneTitles = useReadingFocusSplitPaneTitles(visiblePanes);

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
      <DualPanePane
        pane="outline"
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
      >
        <MarkdownEditor
          key={outlinePath}
          filePath={outlinePath}
          refreshVersion={refreshVersion}
          pathVersion={getPathVersion(outlinePath)}
          layout="preview"
          compact
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
      </DualPanePane>
    ),
    [
      activePane,
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
      getPathVersion,
      showSplitPaneTitles,
    ],
  );

  const draftPane = useMemo(
    () => (
      <DualPanePane
        pane="draft"
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
      >
        <MarkdownEditor
          key={draftPath}
          filePath={draftPath}
          refreshVersion={refreshVersion}
          pathVersion={getPathVersion(draftPath)}
          layout="preview"
          compact
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
          showReadingFocusBar={activePane === "draft"}
        />
      </DualPanePane>
    ),
    [
      activePane,
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
      paperPath,
      refreshVersion,
      getPathVersion,
      showSplitPaneTitles,
    ],
  );

  const notesPane = useMemo(
    () =>
      notesPath ? (
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
            linkContextPath={linkContextPath}
            onNavigate={onNavigate}
            paperPath={paperPath}
            enableDispatch={false}
            showReadingFocusBar={activePane === "notes"}
          />
        </DualPanePane>
      ) : undefined,
    [
      activePane,
      getPathVersion,
      linkContextPath,
      notesPath,
      onActivePaneChange,
      onError,
      onNavigate,
      paperPath,
      refreshVersion,
      showSplitPaneTitles,
    ],
  );

  const editorDualPane = useMemo(
    () => (
      <DualPaneController
        className="min-h-0 flex-1"
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
    ),
    [
      activePane,
      draftPane,
      dualPaneSplit,
      notesPane,
      notesSplitPercent,
      onActivePaneChange,
      onDualPaneSplitChange,
      onNotesSplitChange,
      onVisiblePanesChange,
      outlinePane,
      visiblePanes,
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
  getPathVersion,
  layout,
  onLayoutChange,
  onError,
  linkContextPath = "",
  onNavigate,
  dualPaneSplit,
  onDualPaneSplitChange,
  assetPreviewSplit,
  onAssetPreviewSplitChange,
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  notesSplitPercent,
  onNotesSplitChange,
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
  getPathVersion: (path: string) => number;
  layout: EditorLayout;
  onLayoutChange: (layout: EditorLayout) => void;
  onError: (message: string) => void;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  assetPreviewSplit: number;
  onAssetPreviewSplitChange: (percent: number) => void;
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  notesSplitPercent: number;
  onNotesSplitChange: (percent: number) => void;
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
  const draftPath = unitPath ? draftPathFor(unitPath) : null;
  const readingFocus = useReadingFocus();

  const isPaperEditor = Boolean(paperPath && unitPath === paperPath);
  const isBibFile = activeFile.toLowerCase().endsWith(".bib");

  const layoutButtons: { id: EditorLayout; icon: typeof FileCode2; label: string }[] = isBibFile
    ? [
        { id: "preview", icon: Eye, label: "Preview" },
        { id: "split", icon: Columns2, label: "Split" },
        { id: "source", icon: FileCode2, label: "Source" },
      ]
    : [
        { id: "source", icon: FileCode2, label: "Source" },
        { id: "split", icon: Columns2, label: "Split" },
        { id: "preview", icon: Eye, label: "Preview" },
      ];

  const layoutToggleButtons = (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {layoutButtons.map(({ id, icon: Icon, label }) => (
        <Button
          key={id}
          type="button"
          variant={layout === id ? "default" : "ghost"}
          size="icon"
          className="h-6 w-6"
          aria-label={label}
          title={label}
          onClick={() => onLayoutChange(id)}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );

  const editorChrome = (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-3",
        readingFocus.active && "editor-chrome-hidden",
      )}
    >
      {layoutToggleButtons}
    </div>
  );

  // A .bib activeFile wins over the leaf-unit branch. Opening a reference from
  // inside a unit draft keeps currentPath (and therefore unitPath) on that unit,
  // so without this the leaf-unit editor would keep rendering and the main.bib
  // verification view would never appear.
  if (isBibFile) {
    return (
      <BibMainBibWorkspace
        activeFile={activeFile}
        refreshVersion={refreshVersion}
        getPathVersion={getPathVersion}
        layout={layout}
        onLayoutChange={onLayoutChange}
        editorChrome={editorChrome}
        layoutToggleButtons={layoutToggleButtons}
        dualPaneSplit={dualPaneSplit}
        onDualPaneSplitChange={onDualPaneSplitChange}
        onError={onError}
        linkContextPath={linkContextPath}
        onNavigate={onNavigate}
        onModelChanged={onModelChanged}
        paperPath={paperPath}
      />
    );
  }

  if (isLeafEditor && outlinePath && draftPath && unitPath) {
    return (
      <LeafUnitEditor
        unitPath={unitPath}
        outlinePath={outlinePath}
        draftPath={draftPath}
        refreshVersion={refreshVersion}
        getPathVersion={getPathVersion}
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
        visiblePanes={visiblePanes}
        onVisiblePanesChange={onVisiblePanesChange}
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
        notesSplitPercent={notesSplitPercent}
        onNotesSplitChange={onNotesSplitChange}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {editorChrome}

      <MarkdownEditor
        key={activeFile}
        filePath={activeFile}
        refreshVersion={refreshVersion}
        pathVersion={getPathVersion(activeFile)}
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
