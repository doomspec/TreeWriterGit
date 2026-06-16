import { Columns2, Eye, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarkdownEditor, type EditorLayout } from "@/components/editor/MarkdownEditor";
import { outlinePathFor } from "@/lib/modelTree";

export function EditorWorkspace({
  unitPath,
  activeFile,
  refreshVersion,
  layout,
  onLayoutChange,
  onError,
}: {
  unitPath: string | null;
  activeFile: string;
  refreshVersion: number;
  layout: EditorLayout;
  onLayoutChange: (layout: EditorLayout) => void;
  onError: (message: string) => void;
}) {
  const isUnit = Boolean(unitPath);
  const outlinePath = unitPath ? outlinePathFor(unitPath) : null;
  const draftPath = unitPath ? `${unitPath}/draft.md` : null;

  const layoutButtons: { id: EditorLayout; icon: typeof FileCode2; label: string }[] = [
    { id: "source", icon: FileCode2, label: "Source" },
    { id: "split", icon: Columns2, label: "Split" },
    { id: "preview", icon: Eye, label: "Preview" },
  ];

  if (isUnit && outlinePath && draftPath) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center border-b border-border bg-card px-4">
          <span className="text-xs font-medium text-muted-foreground">Unit editor</span>
        </div>
        <div className="unit-dual-pane grid min-h-0 flex-1">
          <MarkdownEditor
            key={outlinePath}
            filePath={outlinePath}
            refreshVersion={refreshVersion}
            layout="preview"
            compact
            paneLabel="Outline"
            defaultPaneMode="rendered"
            className="min-h-0 border-b border-border lg:border-b-0 lg:border-r"
            onError={onError}
          />
          <MarkdownEditor
            key={draftPath}
            filePath={draftPath}
            refreshVersion={refreshVersion}
            layout="preview"
            compact
            paneLabel="Draft"
            defaultPaneMode="rendered"
            className="min-h-0"
            onError={onError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            {activeFile.split("/").pop() ?? activeFile}
          </button>
        </div>

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
        onError={onError}
      />
    </div>
  );
}
