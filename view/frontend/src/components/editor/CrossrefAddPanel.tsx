import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { entryToBibtex } from "@/lib/bibEntrySource";
import {
  addBibEntryFromCrossref,
  previewNewBibEntryFromCrossref,
  searchCrossrefForBibEntry,
  type BibLibraryEntry,
  type CrossrefCandidate,
} from "@/lib/paperAssets";

function looksLikeDoi(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/\.$/, "")
    .toLowerCase();
  return /^10\.\d{4,}\/[^\s]+$/i.test(normalized);
}

export function CrossrefAddPanel({
  onAdded,
  onError,
}: {
  onAdded: (entry: BibLibraryEntry, created: boolean) => void;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<"search" | "preview">("search");
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [previewingDoi, setPreviewingDoi] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CrossrefCandidate[]>([]);
  const [selected, setSelected] = useState<{
    candidate: CrossrefCandidate;
    entry: BibLibraryEntry;
  } | null>(null);

  useEffect(() => {
    setQuery("");
    setStep("search");
    setSearching(false);
    setAdding(false);
    setPreviewingDoi(null);
    setCandidates([]);
    setSelected(null);
  }, []);

  const busy = searching || adding || previewingDoi !== null;

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      onError("Enter a title or DOI to search Crossref");
      return;
    }
    setStep("search");
    setSelected(null);
    setSearching(true);
    try {
      const results = await searchCrossrefForBibEntry(trimmed);
      if (results.length === 1 && looksLikeDoi(trimmed)) {
        await handleSelectCandidate(results[0]!);
        return;
      }
      setCandidates(results);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCandidate = async (candidate: CrossrefCandidate) => {
    setPreviewingDoi(candidate.doi);
    try {
      const entry = await previewNewBibEntryFromCrossref(candidate.doi);
      setSelected({ candidate, entry });
      setStep("preview");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewingDoi(null);
    }
  };

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    try {
      const result = await addBibEntryFromCrossref(selected.candidate.doi);
      onAdded(result.entry, result.created);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      {step === "search" ? (
        <>
          <div className="flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={query}
              placeholder="Paper title or DOI…"
              disabled={busy}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSearch();
              }}
            />
            <Button
              type="button"
              className="h-9 shrink-0 px-3 text-xs"
              disabled={busy || !query.trim()}
              onClick={() => void handleSearch()}
            >
              {searching ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              )}
              Search
            </Button>
          </div>
          {searching ? (
            <p className="text-sm text-muted-foreground">Searching Crossref…</p>
          ) : candidates.length > 0 ? (
            <div className="divide-y divide-border rounded-md border border-border bg-background">
              {candidates.map((candidate) => (
                <button
                  type="button"
                  key={`${candidate.doi}-${candidate.title}`}
                  className="block w-full px-4 py-3 text-left hover:bg-accent/40 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void handleSelectCandidate(candidate)}
                >
                  <span className="block text-sm font-medium">{candidate.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {previewingDoi === candidate.doi
                      ? "Loading preview…"
                      : `${candidate.doi} · ${candidate.year ?? "n.d."} · ${Math.round(candidate.similarity * 100)}%`}
                  </span>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <p className="text-sm text-muted-foreground">No matches yet — try a title or DOI.</p>
          ) : null}
        </>
      ) : selected ? (
        <section className="min-h-0 rounded-md border border-border bg-background">
          <div className="border-b border-border px-3 py-2">
            <span className="text-xs font-medium">@{selected.entry.citeKey}</span>
            <span className="ml-2 text-xs text-muted-foreground">{selected.candidate.doi}</span>
          </div>
          <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5">
            {entryToBibtex(selected.entry)}
          </pre>
          <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setStep("search");
              }}
            >
              Back
            </Button>
            <Button type="button" className="h-8 px-3 text-xs" disabled={busy} onClick={() => void handleAdd()}>
              {adding ? "Adding…" : "Add reference"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
