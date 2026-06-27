import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function MultiParagraphApprovalDialog({
  open,
  unitCount,
  busy = false,
  onSplitIntoUnits,
  onCombineIntoOne,
  onCancel,
}: {
  open: boolean;
  unitCount: number;
  busy?: boolean;
  onSplitIntoUnits: () => void;
  onCombineIntoOne: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open || busy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  const label =
    unitCount === 1
      ? "1 unit has multiple paragraphs"
      : `${unitCount} units have multiple paragraphs`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="multi-paragraph-dialog-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <h2 id="multi-paragraph-dialog-title" className="text-sm font-semibold">
          Multiple paragraphs per unit
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {label}. Approved units should contain one paragraph each. Choose how to resolve this
          before approving.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            disabled={busy}
            onClick={onCombineIntoOne}
          >
            Combine into one paragraph
          </Button>
          <Button type="button" className="h-8 px-3 text-xs" disabled={busy} onClick={onSplitIntoUnits}>
            {busy ? "Working…" : "Split into separate units"}
          </Button>
        </div>
      </div>
    </div>
  );
}
