import { useEffect, useState } from "react";

import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { fetchDocxPreview } from "@/modelApi";

/** Read-only docx view: server converts to markdown (pandoc, same path as the docx-import feature) and we render it. */
export function ExplorerDocxViewer({
  path,
  onError,
}: {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarkdown(null);
    setError(null);
    void fetchDocxPreview(path)
      .then(({ markdown: converted }) => {
        if (!cancelled) setMarkdown(converted);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        onError?.(message);
      });
    return () => {
      cancelled = true;
    };
  }, [path, onError]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">{error}</div>
    );
  }

  if (markdown === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Converting…</div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={path}>
          {path}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">Read-only</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <MarkdownViewer markdown={markdown} />
      </div>
    </div>
  );
}
