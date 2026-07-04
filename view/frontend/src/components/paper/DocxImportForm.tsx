import { FileUp } from "lucide-react";

import { DocxImportFlowDialogs } from "@/components/paper/DocxImportFlowDialogs";
import { Button } from "@/components/ui/button";
import { useDocxImportFlow } from "@/lib/useDocxImportFlow";
import { cn } from "@/lib/utils";

/** Word import picker UI — used in modal and embedded flows. */
export function DocxImportForm({
  paperSlug,
  paperPath,
  browsePath,
  activeFile,
  onError,
  onComplete,
  onImported,
  className,
}: {
  paperSlug: string;
  paperPath?: string | null;
  browsePath?: string | null;
  activeFile?: string | null;
  onError: (message: string) => void;
  onComplete?: () => void;
  /** Called after a successful import (before onComplete). */
  onImported?: () => void;
  className?: string;
}) {
  const flow = useDocxImportFlow({
    paperSlug,
    paperPath,
    browsePath,
    activeFile,
    onError,
    onComplete: () => {
      onImported?.();
      onComplete?.();
    },
    autoApproveDefault: true,
  });

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <p className="text-xs leading-normal text-muted-foreground">
          Choose a <span className="font-medium text-foreground">.docx</span> file to open a
          confirmation dialog showing how Word headings map to sections and units under{" "}
          <span className="font-mono text-foreground">{paperSlug}</span>.
        </p>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={flow.autoApprove}
            disabled={flow.disabled || flow.previewLoading}
            onChange={(event) => flow.setAutoApprove(event.target.checked)}
          />
          <span className="text-xs leading-normal text-muted-foreground">
            Auto-approve imported unit drafts
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Source document
          </p>
          <button
            type="button"
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-6 text-center transition-colors",
              !(flow.disabled || flow.previewLoading) && "hover:border-primary/40 hover:bg-accent/30",
              (flow.disabled || flow.previewLoading) && "opacity-60",
            )}
            disabled={flow.disabled || flow.previewLoading}
            onClick={flow.openFilePicker}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (flow.disabled || flow.previewLoading) return;
              flow.pickFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <FileUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">
              {flow.previewLoading
                ? "Analyzing…"
                : flow.file
                  ? flow.file.name
                  : "Choose or drop a .docx file"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Opens structure confirmation before import
            </span>
          </button>
        </div>

        {flow.notice ? (
          <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[11px] leading-normal text-muted-foreground">
            {flow.notice}
          </p>
        ) : null}

        {flow.file && !flow.confirmOpen ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-full justify-center gap-1.5"
            disabled={flow.disabled || flow.previewLoading}
            onClick={() => void flow.beginReview(flow.file!)}
          >
            Review import structure again…
          </Button>
        ) : null}
      </div>

      <DocxImportFlowDialogs flow={flow} />
    </>
  );
}
