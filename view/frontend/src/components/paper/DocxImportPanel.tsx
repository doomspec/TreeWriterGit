import { DocxImportForm } from "@/components/paper/DocxImportForm";
import { cn } from "@/lib/utils";

/** Embedded Word import UI (e.g. new-manuscript wizard). Prefer DocxImportModal in the main app. */
export function DocxImportPanel({
  paperSlug,
  paperPath,
  browsePath,
  activeFile,
  onError,
  onComplete,
  className,
}: {
  paperSlug: string | null;
  paperPath?: string | null;
  browsePath?: string | null;
  activeFile?: string | null;
  onError: (message: string) => void;
  onComplete?: () => void;
  className?: string;
}) {
  if (!paperSlug) {
    return (
      <div className={cn("p-3 text-xs leading-normal text-muted-foreground", className)}>
        Open a paper to import a Word document into its model tree.
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <DocxImportForm
        paperSlug={paperSlug}
        paperPath={paperPath}
        browsePath={browsePath}
        activeFile={activeFile}
        onError={onError}
        onComplete={onComplete}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      />
    </div>
  );
}
