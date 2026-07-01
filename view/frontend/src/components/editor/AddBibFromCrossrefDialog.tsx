import { useEffect } from "react";

import { CrossrefAddPanel } from "@/components/editor/CrossrefAddPanel";
import type { BibLibraryEntry } from "@/lib/paperAssets";

export function AddBibFromCrossrefDialog({
  open,
  onClose,
  onAdded,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (entry: BibLibraryEntry, created: boolean) => void;
  onError: (message: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-bib-crossref-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id="add-bib-crossref-title" className="text-sm font-semibold">
            Add reference from Crossref
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <CrossrefAddPanel
            onAdded={(entry, created) => {
              onAdded(entry, created);
              onClose();
            }}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}
