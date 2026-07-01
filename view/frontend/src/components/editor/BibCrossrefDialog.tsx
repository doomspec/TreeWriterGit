import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { entryToBibtex } from "@/lib/bibEntrySource";
import type { BibLibraryEntry, CrossrefCandidate } from "@/lib/paperAssets";

export function BibCrossrefDialog({
  open,
  mode,
  candidates,
  replacement,
  loadingCandidates,
  previewingDoi,
  busy,
  onSelectCandidate,
  onBack,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  mode: "candidates" | "compare";
  candidates: CrossrefCandidate[];
  replacement: {
    candidate: CrossrefCandidate;
    oldEntry: BibLibraryEntry;
    newEntry: BibLibraryEntry;
  } | null;
  loadingCandidates: boolean;
  previewingDoi: string | null;
  busy: boolean;
  onSelectCandidate: (candidate: CrossrefCandidate) => void;
  onBack: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, open]);

  if (!open) return null;
  const comparing = mode === "compare" && replacement;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bib-crossref-title"
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id="bib-crossref-title" className="text-sm font-semibold">
            {comparing ? "Replace BibTeX item" : "Crossref matches"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {comparing
              ? `@${replacement.oldEntry.citeKey} - ${replacement.candidate.doi}`
              : "Select a candidate to preview the replacement."}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {comparing ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <section className="min-h-0 rounded-md border border-border bg-background">
                <div className="border-b border-border px-3 py-2">
                  <span className="text-xs font-medium">Current item</span>
                </div>
                <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5">
                  {entryToBibtex(replacement.oldEntry)}
                </pre>
              </section>
              <section className="min-h-0 rounded-md border border-border bg-background">
                <div className="border-b border-border px-3 py-2">
                  <span className="text-xs font-medium">New item</span>
                </div>
                <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5">
                  {entryToBibtex(replacement.newEntry)}
                </pre>
              </section>
            </div>
          ) : loadingCandidates ? (
            <p className="text-sm text-muted-foreground">Searching Crossref...</p>
          ) : candidates.length > 0 ? (
            <div className="divide-y divide-border rounded-md border border-border bg-background">
              {candidates.map((candidate) => (
                <button
                  type="button"
                  key={`${candidate.doi}-${candidate.title}`}
                  className="block w-full px-4 py-3 text-left hover:bg-accent/40 disabled:opacity-60"
                  disabled={busy || previewingDoi !== null}
                  onClick={() => onSelectCandidate(candidate)}
                >
                  <span className="block text-sm font-medium">{candidate.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {previewingDoi === candidate.doi
                      ? "Loading replacement..."
                      : `${candidate.doi} - ${candidate.year ?? "n.d."} - ${Math.round(candidate.similarity * 100)}%`}
                  </span>
                  {candidate.authors ? (
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {candidate.authors}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Crossref matches found.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          {comparing ? (
            <>
              <Button type="button" variant="outline" className="h-8 px-3 text-xs" disabled={busy} onClick={onBack}>
                Back
              </Button>
              <Button type="button" className="h-8 px-3 text-xs" disabled={busy} onClick={onConfirm}>
                {busy ? "Replacing..." : "Replace item"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
