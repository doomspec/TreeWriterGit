import { useCallback, useRef, useState } from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { importDocxIntoPaper } from "@/modelApi";
import { cn } from "@/lib/utils";

const DOCX_ACCEPT =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function DocxImportPanel({
  paperSlug,
  onError,
  onComplete,
  className,
}: {
  paperSlug: string | null;
  onError: (message: string) => void;
  onComplete?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const disabled = !paperSlug || importing;

  const pickFile = useCallback(
    (next: File | null) => {
      if (!next) {
        setFile(null);
        return;
      }
      const name = next.name.toLowerCase();
      if (!name.endsWith(".docx")) {
        onError("Please choose a .docx Word document.");
        return;
      }
      setFile(next);
      setNotice(null);
    },
    [onError],
  );

  const handleImport = async () => {
    if (!paperSlug || !file) return;
    setImporting(true);
    setNotice(null);
    try {
      const data = await file.arrayBuffer();
      const result = await importDocxIntoPaper({
        paperSlug,
        file,
        autoApprove,
      });
      const summary = [
        `Imported ${result.sectionsCreated} section${result.sectionsCreated === 1 ? "" : "s"}`,
        `${result.unitsCreated} unit${result.unitsCreated === 1 ? "" : "s"}`,
      ].join(" and ");
      setNotice(
        result.notice
          ? `${summary}. ${result.notice}`
          : result.paperTitle
            ? `${summary} from “${result.paperTitle}”.`
            : `${summary}.`,
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  if (!paperSlug) {
    return (
      <div className={cn("p-3 text-xs leading-normal text-muted-foreground", className)}>
        Open a paper to import a Word document into its model tree.
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="shrink-0 border-b border-border px-3 py-2">
        <p className="ui-label">Import from Word</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-4 text-xs leading-normal text-muted-foreground">
          Converts a <span className="font-medium text-foreground">.docx</span> file with pandoc,
          then creates sections from Word Heading 2 and units from Heading 3 or paragraphs under{" "}
          <span className="font-mono text-foreground">{paperSlug}</span>.
        </p>

        <label className="mb-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={autoApprove}
            disabled={disabled}
            onChange={(event) => setAutoApprove(event.target.checked)}
          />
          <span className="text-xs leading-normal text-muted-foreground">
            Auto-approve imported unit drafts
          </span>
        </label>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Source document
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={DOCX_ACCEPT}
              className="sr-only"
              disabled={disabled}
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-6 text-center transition-colors",
                !disabled && "hover:border-primary/40 hover:bg-accent/30",
                disabled && "opacity-60",
              )}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (disabled) return;
                pickFile(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <FileUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium text-foreground">
                {file ? file.name : "Choose or drop a .docx file"}
              </span>
              <span className="text-[11px] text-muted-foreground">Microsoft Word (.docx)</span>
            </button>
          </div>

          {notice ? (
            <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[11px] leading-normal text-muted-foreground">
              {notice}
            </p>
          ) : null}

          <Button
            type="button"
            size="sm"
            className="h-8 w-full justify-center gap-1.5"
            disabled={disabled || !file}
            onClick={() => void handleImport()}
          >
            <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {importing ? "Importing…" : "Import into paper"}
          </Button>
        </div>
      </div>
    </div>
  );
}
