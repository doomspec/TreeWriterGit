import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Search } from "lucide-react";

import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ComposedDraftEditor } from "@/components/editor/ComposedDraftEditor";
import {
  ReadingFocusExtra,
} from "@/components/editor/ReadingFocusNavBar";
import { SearchResults } from "@/components/layout/SearchResults";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { Button } from "@/components/ui/button";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";
import { normalizeComposedDraftBody } from "@/lib/sectionCompose";
import { useReadingFocus } from "@/lib/readingFocus";
import type { DualPaneActive, DualPaneView } from "@/lib/workspacePreferences";
import { fetchSectionCompose, type SearchHit } from "@/modelApi";

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
  searchQuery,
  onSearchChange,
  onSearchSelect,
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
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSelect?: (hit: SearchHit) => void;
}) {
  const [compose, setCompose] = useState<Awaited<ReturnType<typeof fetchSectionCompose>> | null>(null);
  const [loading, setLoading] = useState(true);
  const hasComposeRef = useRef(false);
  const readingFocus = useReadingFocus();
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
        linkContextPath={paperPath}
        onNavigate={handleLinkNavigate}
        onError={onError}
        onSynced={() => {
          void loadCompose(true);
          onDispatchComplete?.();
        }}
        paneLabel="Paper draft"
        subtitle="Composed from sections · edits sync to units"
      />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 border-b border-border bg-card">
        <div className="flex h-10 items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="hidden min-w-0 max-w-[9rem] truncate text-xs font-medium text-foreground lg:block">
              {compose.title}
            </p>
            <div className="relative min-w-[10rem] max-w-sm flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search this paper…"
                value={searchQuery}
                className="ui-input h-8 w-full"
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={() => onOpenFile(outlinePath)}
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Edit outline source</span>
              <span className="sm:hidden">Outline</span>
            </Button>
          </div>
        </div>
        {onSearchSelect ? (
          <SearchResults query={searchQuery} root={paperPath} onSelect={onSearchSelect} />
        ) : null}
      </div>

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
