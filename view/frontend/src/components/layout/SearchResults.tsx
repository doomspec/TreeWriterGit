import { useEffect, useState } from "react";

import { searchModel, type SearchHit } from "@/modelApi";

export function SearchResults({
  query,
  root,
  onSelect,
}: {
  query: string;
  root?: string;
  onSelect: (hit: SearchHit) => void;
}) {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchModel(q, root ?? "", 30)
        .then((data) => {
          if (!cancelled) {
            setResults(data.results);
            setError(null);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setResults([]);
            setError(err instanceof Error ? err.message : String(err));
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, root]);

  if (query.trim().length < 2) return null;

  return (
    <div className="border-b border-border bg-background px-3 py-2">
      {loading ? (
        <p className="text-[11px] text-muted-foreground">Searching…</p>
      ) : error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : results.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No matches.</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-auto" aria-label="Search results">
          {results.map((hit) => (
            <li key={`${hit.path}:${hit.line}`}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-accent/50"
                onClick={() => onSelect(hit)}
              >
                <div className="truncate font-mono text-[10px] text-muted-foreground">
                  {hit.path}:{hit.line}
                </div>
                <div className="line-clamp-2 text-[11px] text-foreground">{hit.excerpt}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
