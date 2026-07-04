import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export const MAIN_BIB_MANUAL_EDIT_MESSAGE =
  "Raw BibTeX edits can break cite keys and citation links. Use the reference manager for add, edit, and verify; manual editing is for advanced fixes only.";

export function MainBibManualEditDialog({
  open,
  loading = false,
  onOpenReferenceManager,
  onProceedManually,
  onCancel,
}: {
  open: boolean;
  loading?: boolean;
  onOpenReferenceManager: () => void;
  onProceedManually: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open || loading) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (loading) return;
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <h2 className="text-sm font-semibold">Edit main.bib manually?</h2>
        <p className="mt-2 text-sm text-muted-foreground">{MAIN_BIB_MANUAL_EDIT_MESSAGE}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            className="h-8 w-full justify-center px-3 text-xs"
            onClick={onOpenReferenceManager}
            disabled={loading}
          >
            Open reference manager
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full justify-center gap-1.5 px-3 text-xs"
            onClick={onProceedManually}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Edit manually anyway
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full justify-center px-3 text-xs"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
