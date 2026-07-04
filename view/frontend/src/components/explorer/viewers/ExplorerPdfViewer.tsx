import { ExternalLink } from "lucide-react";

import { modelAssetUrl } from "@/modelApi";

/** Read-only PDF view via the browser's native PDF renderer. */
export function ExplorerPdfViewer({
  path,
}: {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const url = modelAssetUrl(path);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={path}>
          {path}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Open in new tab
        </a>
      </div>
      <div className="min-h-0 flex-1">
        <embed src={url} type="application/pdf" className="h-full w-full" />
      </div>
    </div>
  );
}
