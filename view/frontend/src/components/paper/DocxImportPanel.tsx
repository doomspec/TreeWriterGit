import { useCallback, useRef, useState } from "react";
import { FileUp, FolderTree } from "lucide-react";

import { DocxImportConfirmDialog } from "@/components/paper/DocxImportConfirmDialog";
import { Button } from "@/components/ui/button";
import { importDocxIntoPaper, previewDocxImport } from "@/modelApi";
import { cn } from "@/lib/utils";
import { cloneImportPlan } from "@/lib/docxImportPlanEdit";
import type { DocxImportPreview, DocxImportPreviewNode } from "@treewriter/shared";

const DOCX_ACCEPT =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function defaultImportTargetSection(
  paperPath: string | null,
  browsePath: string | null,
  activeFile: string | null,
): string {
  if (!paperPath) return "";
  let folder = browsePath ?? "";
  if (activeFile?.startsWith(`${paperPath}/`) && activeFile.endsWith(".md")) {
    folder = activeFile.slice(0, activeFile.lastIndexOf("/"));
  }
  if (!folder.startsWith(`${paperPath}/`) || folder === paperPath) return "";
  return folder.slice(paperPath.length + 1);
}

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [autoApprove, setAutoApprove] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<DocxImportPreview | null>(null);
  const [importedPlan, setImportedPlan] = useState<DocxImportPreviewNode[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [targetSection, setTargetSection] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const disabled = !paperSlug || importing;

  const loadPreview = useCallback(
    async (nextFile: File, nextTargetSection: string, nextReplaceExisting: boolean) => {
      if (!paperSlug) return;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await previewDocxImport({
          paperSlug,
          file: nextFile,
          targetSection: nextTargetSection || undefined,
          replaceTarget: nextReplaceExisting,
        });
        setPreview(result);
        setImportedPlan(cloneImportPlan(result.imported));
        setTargetSection(result.importTargetSlug);
        setReplaceExisting(result.replaceExisting);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPreviewError(message);
        setPreview(null);
        onError(message);
      } finally {
        setPreviewLoading(false);
      }
    },
    [onError, paperSlug],
  );

  const beginReview = useCallback(
    async (nextFile: File) => {
      const initialTarget = defaultImportTargetSection(
        paperPath ?? null,
        browsePath ?? null,
        activeFile ?? null,
      );
      setFile(nextFile);
      setNotice(null);
      setPreview(null);
      setImportedPlan([]);
      setPreviewError(null);
      setTargetSection(initialTarget);
      setReplaceExisting(true);
      setConfirmOpen(true);
      await loadPreview(nextFile, initialTarget, true);
    },
    [activeFile, browsePath, loadPreview, paperPath],
  );

  const pickFile = useCallback(
    (next: File | null) => {
      if (!next) {
        setFile(null);
        setConfirmOpen(false);
        setPreview(null);
        setPreviewError(null);
        return;
      }
      const name = next.name.toLowerCase();
      if (!name.endsWith(".docx")) {
        onError("Please choose a .docx Word document.");
        return;
      }
      void beginReview(next);
    },
    [beginReview, onError],
  );

  const handleTargetSectionChange = (slug: string) => {
    setTargetSection(slug);
    if (file) void loadPreview(file, slug, replaceExisting);
  };

  const handleReplaceExistingChange = (value: boolean) => {
    setReplaceExisting(value);
    if (file) void loadPreview(file, targetSection, value);
  };

  const handleConfirmImport = async () => {
    if (!paperSlug || !file || !preview) return;
    setImporting(true);
    setNotice(null);
    try {
      const result = await importDocxIntoPaper({
        paperSlug,
        file,
        autoApprove,
        targetSection: targetSection || undefined,
        replaceTarget: replaceExisting,
        importPlan: importedPlan,
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
      setConfirmOpen(false);
      setPreview(null);
      setImportedPlan([]);
      setPreviewError(null);
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
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
        <div className="shrink-0 border-b border-border px-3 py-2">
          <p className="ui-label">Import from Word</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-4 text-xs leading-normal text-muted-foreground">
            Choose a <span className="font-medium text-foreground">.docx</span> file to open a
            confirmation dialog showing how Word headings map to sections and units under{" "}
            <span className="font-mono text-foreground">{paperSlug}</span>.
          </p>

          <label className="mb-4 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={autoApprove}
              disabled={disabled || previewLoading}
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
                disabled={disabled || previewLoading}
                onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-6 text-center transition-colors",
                  !(disabled || previewLoading) && "hover:border-primary/40 hover:bg-accent/30",
                  (disabled || previewLoading) && "opacity-60",
                )}
                disabled={disabled || previewLoading}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (disabled || previewLoading) return;
                  pickFile(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <FileUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">
                  {previewLoading
                    ? "Analyzing…"
                    : file
                      ? file.name
                      : "Choose or drop a .docx file"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Opens structure confirmation before import
                </span>
              </button>
            </div>

            {notice ? (
              <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[11px] leading-normal text-muted-foreground">
                {notice}
              </p>
            ) : null}

            {file && !confirmOpen ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-full justify-center gap-1.5"
                disabled={disabled || previewLoading}
                onClick={() => void beginReview(file)}
              >
                Review import structure again…
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <DocxImportConfirmDialog
        open={confirmOpen}
        preview={preview}
        previewError={previewError}
        targetSection={targetSection}
        replaceExisting={replaceExisting}
        importedPlan={importedPlan}
        loading={previewLoading}
        importing={importing}
        onTargetSectionChange={handleTargetSectionChange}
        onReplaceExistingChange={handleReplaceExistingChange}
        onImportedPlanChange={setImportedPlan}
        onConfirm={() => void handleConfirmImport()}
        onCancel={() => {
          if (importing) return;
          setConfirmOpen(false);
          setPreview(null);
          setPreviewError(null);
        }}
      />
    </>
  );
}
