import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { DocxImportForm } from "@/components/paper/DocxImportForm";
import { useModalFocusTrap } from "@/lib/useModalFocusTrap";

export function DocxImportModal({
  open,
  paperSlug,
  paperPath,
  browsePath,
  activeFile,
  onClose,
  onError,
  onComplete,
}: {
  open: boolean;
  paperSlug: string;
  paperPath?: string | null;
  browsePath?: string | null;
  activeFile?: string | null;
  onClose: () => void;
  onError: (message: string) => void;
  onComplete?: () => void;
}) {
  const dialogRef = useModalFocusTrap(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="docx-import-title"
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-md border border-border bg-background shadow-lg outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 id="docx-import-title" className="text-sm font-semibold">
            Import from Word
          </h2>
          <button
            type="button"
            className="rounded-sm p-1 hover:bg-accent"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 py-4">
          <DocxImportForm
            paperSlug={paperSlug}
            paperPath={paperPath}
            browsePath={browsePath}
            activeFile={activeFile}
            onError={onError}
            onComplete={onComplete}
            onImported={onClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
