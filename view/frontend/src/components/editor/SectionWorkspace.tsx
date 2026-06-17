import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Pencil } from "lucide-react";

import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { Button } from "@/components/ui/button";
import {
  dispatchActionForSectionPane,
  dispatchActionLabel,
  isDispatchRunShortcut,
  runFanOutDispatchSilent,
} from "@/lib/agentDispatchClient";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type SectionCompose = {
  path: string;
  title: string;
  kind: string | null;
  outlineMarkdown: string;
  draftMarkdown: string;
  children: Array<{
    name: string;
    path: string;
    title: string;
    summary: string | null;
    kind: "unit" | "section";
  }>;
};

export function SectionWorkspace({
  sectionPath,
  refreshVersion,
  onNavigate,
  onOpenFile,
  onError,
  dualPaneSplit,
  onDualPaneSplitChange,
  onDispatchComplete,
}: {
  sectionPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onError: (message: string) => void;
  dualPaneSplit: number;
  onDualPaneSplitChange: (percent: number) => void;
  onDispatchComplete?: () => void;
}) {
  const [compose, setCompose] = useState<SectionCompose | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedPane, setFocusedPane] = useState<"outline" | "draft">("outline");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchingPane, setDispatchingPane] = useState<"outline" | "draft" | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadCompose = useCallback(() => {
    setLoading(true);
    return fetch(`${apiBaseUrl}/api/model/section-compose?path=${encodeURIComponent(sectionPath)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load section view (${res.status})`);
        return (await res.json()) as SectionCompose;
      })
      .then((data) => {
        setCompose(data);
        setLoading(false);
      })
      .catch((err) => {
        setCompose(null);
        setLoading(false);
        onError(err instanceof Error ? err.message : String(err));
      });
  }, [onError, sectionPath]);

  useEffect(() => {
    let cancelled = false;
    void loadCompose().then(() => {
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
      setFocusedPane(pane);
      setDispatchingPane(pane);
      const action = dispatchActionForSectionPane(pane);
      setDispatching(true);
      try {
        const count = await runFanOutDispatchSilent({
          sectionPath,
          action,
        });
        if (count === 0) {
          onError("No units found under this section");
          return;
        }
        await loadCompose();
        onDispatchComplete?.();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setDispatching(false);
        setDispatchingPane(null);
      }
    },
    [loadCompose, onDispatchComplete, onError, sectionPath],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isDispatchRunShortcut(event)) return;
      if (!containerRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      void handleFanOut(focusedPane);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedPane, handleFanOut]);

  const outlinePath = outlinePathFor(sectionPath);
  const draftPath = `${sectionPath}/draft.md`;

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
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-6 gap-1 px-2 text-[10px]"
      title={`${dispatchActionLabel(dispatchActionForSectionPane(pane))} (⌘⇧R)`}
      disabled={dispatching}
      aria-busy={dispatching && dispatchingPane === pane}
      onClick={() => void handleFanOut(pane)}
    >
      <Bot className="h-3 w-3" aria-hidden="true" />
      {dispatching && dispatchingPane === pane ? "…" : "AI"}
    </Button>
  );

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <span className="text-xs font-medium text-muted-foreground">
          Section · {compose.title}
          {compose.kind ? ` (${compose.kind})` : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => onOpenFile(outlinePath)}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit outline
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => onOpenFile(draftPath)}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit draft
          </Button>
        </div>
      </div>

      <ResizableDualPane
        splitPercent={dualPaneSplit}
        onSplitChange={onDualPaneSplitChange}
        left={
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            tabIndex={-1}
            onFocusCapture={() => setFocusedPane("outline")}
            onMouseDown={() => setFocusedPane("outline")}
          >
            <div className="ui-pane-header">
              <span className="ui-label">Outline</span>
              {aiButton("outline")}
            </div>
            <div className="markdown-pane min-h-0 flex-1 overflow-auto px-6 py-5">
              <MarkdownViewer
                markdown={compose.outlineMarkdown}
                linkContextPath={sectionPath}
                linksClickable
                onNavigate={handleLinkNavigate}
              />
            </div>
          </div>
        }
        right={
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            tabIndex={-1}
            onFocusCapture={() => setFocusedPane("draft")}
            onMouseDown={() => setFocusedPane("draft")}
          >
            <div className="ui-pane-header">
              <span className="ui-label">Draft</span>
              {aiButton("draft")}
            </div>
            <div className="markdown-pane min-h-0 flex-1 overflow-auto px-6 py-5">
              {compose.draftMarkdown.trim() ? (
                <MarkdownViewer
                  markdown={compose.draftMarkdown.replace(/^#\s+.+\n+/, "")}
                  linkContextPath={sectionPath}
                  linksClickable
                  onNavigate={handleLinkNavigate}
                />
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No draft content yet — use AI on Outline to draft units, or open subsections to write.
                </p>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
