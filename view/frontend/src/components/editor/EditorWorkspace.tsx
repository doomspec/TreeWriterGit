import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Columns2, Eye, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FigurePreviewPanel } from "@/components/editor/FigurePreviewPanel";
import { MarkdownEditor, type EditorLayout } from "@/components/editor/MarkdownEditor";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { outlinePathFor, stripFrontmatter, type NavigateTarget } from "@/lib/modelTree";

function captionFromDraft(content: string): string {
  return stripFrontmatter(content)
    .replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "")
    .trim();
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
  onSendToTerminal,
  onBeforeDispatch,
  onDispatchComplete,
  onBackToSectionView,
  backLabel = "Section view",
  isFigure = false,
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
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
  onDispatchComplete?: () => void;
  /** Return to composed section outline + draft view. */
  onBackToSectionView?: () => void;
  backLabel?: string;
  isFigure?: boolean;
  onModelChanged?: () => void;
  paperPath?: string | null;
}) {
  const isLeafEditor = Boolean(unitPath);
  const outlinePath = unitPath ? outlinePathFor(unitPath) : null;
  const draftPath = unitPath ? `${unitPath}/draft.md` : null;
  const [liveDraftCaption, setLiveDraftCaption] = useState<string | null>(null);

  const handleDraftContentChange = useCallback(
    (content: string) => {
      if (isFigure) setLiveDraftCaption(captionFromDraft(content));
    },
    [isFigure],
  );

  useEffect(() => {
    setLiveDraftCaption(null);
  }, [unitPath, refreshVersion]);

  const layoutButtons: { id: EditorLayout; icon: typeof FileCode2; label: string }[] = [
    { id: "source", icon: FileCode2, label: "Source" },
    { id: "split", icon: Columns2, label: "Split" },
    { id: "preview", icon: Eye, label: "Preview" },
  ];

  const isPaperEditor = Boolean(paperPath && unitPath === paperPath);

  if (isLeafEditor && outlinePath && draftPath) {
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
          }
          right={
            <MarkdownEditor
              key={draftPath}
              filePath={draftPath}
              refreshVersion={refreshVersion}
              layout="preview"
              compact
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
              onContentChange={handleDraftContentChange}
              paperPath={paperPath}
            />
          }
        />
        {isFigure && unitPath ? (
          <FigurePreviewPanel
            unitPath={unitPath}
            refreshVersion={refreshVersion}
            liveCaption={liveDraftCaption}
            embeddedInEditor
            onModelChanged={onModelChanged}
            onError={onError}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
        {onBackToSectionView ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[10px]"
            onClick={onBackToSectionView}
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            {backLabel}
          </Button>
        ) : (
          <span />
        )}
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
