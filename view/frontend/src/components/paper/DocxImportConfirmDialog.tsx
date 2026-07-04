import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, FolderTree } from "lucide-react";

import { ImportPreviewEditor } from "@/components/paper/ImportPreviewEditor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { countImportPlan } from "@/lib/docxImportPlanEdit";
import type { DocxImportPreview, DocxImportPreviewNode } from "@treewriter/shared";

function PreviewTree({
  nodes,
  variant,
  depth = 0,
}: {
  nodes: DocxImportPreviewNode[];
  variant: "existing" | "imported";
  depth?: number;
}) {
  if (nodes.length === 0) {
    return (
      <p className="px-2 py-1.5 text-[11px] italic text-muted-foreground">
        {variant === "existing" ? "No existing children" : "No sections detected"}
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={`${depth}-${node.slug}`}>
          <div
            className={cn(
              "flex items-start gap-1.5 rounded px-2 py-1 text-[11px] leading-snug",
              variant === "existing" ? "bg-destructive/5 text-foreground" : "bg-primary/5 text-foreground",
              depth > 0 && "ml-3 border-l border-border pl-2",
            )}
          >
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                node.kind === "unit"
                  ? "bg-muted text-muted-foreground"
                  : variant === "existing"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
              )}
            >
              {node.kind === "unit" ? "unit" : node.kind}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{node.title}</span>
              <span className="ml-1 font-mono text-[10px] text-muted-foreground">{node.slug}</span>
            </span>
          </div>
          {node.children?.length ? (
            <PreviewTree nodes={node.children} variant={variant} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function DocxImportConfirmDialog({
  open,
  preview,
  previewError,
  targetSection,
  replaceExisting,
  importedPlan,
  loading,
  importing,
  onTargetSectionChange,
  onReplaceExistingChange,
  onImportedPlanChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  preview: DocxImportPreview | null;
  previewError?: string | null;
  targetSection: string;
  replaceExisting: boolean;
  importedPlan: DocxImportPreviewNode[];
  loading?: boolean;
  importing?: boolean;
  onTargetSectionChange: (slug: string) => void;
  onReplaceExistingChange: (value: boolean) => void;
  onImportedPlanChange: (nodes: DocxImportPreviewNode[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importing && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importing, loading, onCancel, open]);

  if (!open) return null;

  const planStats = countImportPlan(importedPlan);
  const topLevelKind: "section" | "subsection" = targetSection ? "subsection" : "section";

  const dialog = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !importing && !loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="docx-import-confirm-title"
        className="flex max-h-[min(92vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-start gap-2">
            <FolderTree className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="docx-import-confirm-title" className="text-sm font-semibold">
                Confirm import structure
              </h2>
              <p className="mt-1 text-xs leading-normal text-muted-foreground">
                Review and reorganize how Word headings map to TreeWriter sections, subsections, and
                units before writing to the model.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading && !preview ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Analyzing Word document…</p>
          ) : previewError && !preview ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {previewError}
            </p>
          ) : preview ? (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Import target
                  </span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none ring-primary focus:ring-1"
                    value={targetSection}
                    disabled={loading || importing}
                    onChange={(event) => onTargetSectionChange(event.target.value)}
                  >
                    {preview.availableTargets.map((target) => (
                      <option key={target.slug || "__paper_root__"} value={target.slug}>
                        {target.title} ({target.existingNodeCount} existing)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-muted/20 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={replaceExisting}
                    disabled={loading || importing}
                    onChange={(event) => onReplaceExistingChange(event.target.checked)}
                  />
                  <span className="text-xs leading-normal text-muted-foreground">
                    Replace existing sections and units under{" "}
                    <span className="font-mono text-foreground">{preview.importTargetTitle}</span>
                  </span>
                </label>
              </div>

              {preview.importedPaperTitle ? (
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Word title:{" "}
                  <span className="font-medium text-foreground">{preview.importedPaperTitle}</span>
                </p>
              ) : null}

              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  Importing{" "}
                  <span className="font-medium text-foreground">
                    {planStats.sectionsCreated} section{planStats.sectionsCreated === 1 ? "" : "s"}
                  </span>{" "}
                  and{" "}
                  <span className="font-medium text-foreground">
                    {planStats.unitsCreated} unit{planStats.unitsCreated === 1 ? "" : "s"}
                  </span>
                </span>
                {loading ? <span className="italic">Updating preview…</span> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.4fr)] md:items-start">
                <div className="min-w-0 rounded-md border border-border">
                  <div className="border-b border-border px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-destructive">
                      {replaceExisting ? "Will remove" : "Existing (kept)"}
                    </p>
                  </div>
                  <div className="max-h-[min(52vh,420px)] overflow-y-auto py-1">
                    <PreviewTree nodes={preview.existing} variant="existing" />
                  </div>
                </div>

                <div className="hidden justify-center self-center md:flex">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>

                <div className="min-w-0 rounded-md border border-border">
                  <div className="border-b border-border px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                      Will create — drag to reorganize
                    </p>
                  </div>
                  <div className="max-h-[min(52vh,420px)] overflow-y-auto p-1">
                    <ImportPreviewEditor
                      nodes={importedPlan}
                      topLevelKind={topLevelKind}
                      disabled={loading || importing}
                      onChange={onImportedPlanChange}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            disabled={importing}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-8 px-3 text-xs"
            disabled={loading || importing || !preview || importedPlan.length === 0}
            onClick={onConfirm}
          >
            {importing ? "Importing…" : "Confirm import"}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
