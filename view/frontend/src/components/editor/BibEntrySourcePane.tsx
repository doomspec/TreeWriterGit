import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ensureBibEntry, subscribeBibLibraryInvalidate } from "@/lib/bibLibraryStore";
import { entryToBibtex } from "@/lib/bibEntrySource";

export function BibEntrySourcePane({
  citeKey,
  totalEntries,
  onLoadFullSource,
}: {
  citeKey: string | null;
  totalEntries?: number;
  onLoadFullSource: () => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => subscribeBibLibraryInvalidate(() => setRefreshTick((n) => n + 1)), []);

  useEffect(() => {
    if (!citeKey) {
      setSource(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void ensureBibEntry(citeKey)
      .then((entry) => {
        if (!cancelled) setSource(entryToBibtex(entry));
      })
      .catch((err) => {
        if (!cancelled) {
          setSource(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [citeKey, refreshTick]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border bg-muted/20">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Entry source</span>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onLoadFullSource}>
          Load full main.bib
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!citeKey ? (
          <p className="text-sm text-muted-foreground">
            Select a reference to view its BibTeX source
            {totalEntries != null ? ` (${totalEntries} entries in library).` : "."}
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading @{citeKey}…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-foreground">{source}</pre>
        )}
      </div>
    </div>
  );
}
