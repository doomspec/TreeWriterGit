import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ComposedDraftEditor } from "@/components/editor/ComposedDraftEditor";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { Button } from "@/components/ui/button";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type PaperCompose = {
  path: string;
  title: string;
  draftMarkdown: string;
  children: Array<{
    name: string;
    path: string;
    title: string;
    summary: string | null;
    kind: "unit" | "section" | "figure" | "table";
  }>;
};

export function PaperWorkspace({
  paperPath,
  refreshVersion,
  onNavigate,
  onOpenFile,
  onError,
  dualPaneSplit,
  onDualPaneSplitChange,
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
  onDispatchComplete?: () => void;
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
}) {
  const [compose, setCompose] = useState<PaperCompose | null>(null);
  const [loading, setLoading] = useState(true);
  const outlinePath = outlinePathFor(paperPath);

  const loadCompose = useCallback(() => {
    setLoading(true);
    return fetch(`${apiBaseUrl}/api/model/section-compose?path=${encodeURIComponent(paperPath)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load paper draft (${res.status})`);
        return (await res.json()) as PaperCompose;
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
  }, [onError, paperPath]);

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

  if (loading || !compose) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {loading ? "Composing paper draft…" : "Could not load paper draft."}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-end border-b border-border bg-card px-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => onOpenFile(outlinePath)}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit outline source
          </Button>
        </div>
      </div>

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
            paneLabel="Paper outline"
            defaultPaneMode="rendered"
            className="min-h-0 flex-1"
            onError={onError}
            linkContextPath={paperPath}
            onNavigate={handleLinkNavigate}
            onSendToTerminal={onSendToTerminal}
            onBeforeDispatch={onBeforeDispatch}
            onDispatchComplete={() => {
              void loadCompose();
              onDispatchComplete?.();
            }}
            paperPath={paperPath}
          />
        }
        right={
          <ComposedDraftEditor
            containerPath={paperPath}
            title={compose.title}
            markdown={compose.draftMarkdown.replace(/^#\s+.+\n+/, "")}
            refreshVersion={refreshVersion}
            linkContextPath={paperPath}
            children={compose.children}
            onNavigate={handleLinkNavigate}
            onError={onError}
            onSynced={onDispatchComplete}
            paneLabel="Paper draft"
            subtitle="Composed from sections · edits sync to units"
          />
        }
      />
    </div>
  );
}
