import { modelAssetUrl } from "@/modelApi";

/** Read-only image view. */
export function ExplorerImageViewer({
  path,
}: {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={path}>
          {path}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20 p-4">
        <img src={modelAssetUrl(path)} alt={path} className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}
