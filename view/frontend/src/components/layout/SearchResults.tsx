import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { searchModel, type SearchHit } from "@/modelApi";

function SearchResultsPanel({
  loading,
  error,
  results,
  onSelect,
  className,
}: {
  loading: boolean;
  error: string | null;
  results: SearchHit[];
  onSelect: (hit: SearchHit) => void;
  className?: string;
}) {
  return (
    <div className={cn("border border-border bg-popover px-3 py-2 shadow-lg", className)}>
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

export function SearchResults({
  query,
  root,
  onSelect,
  className,
  anchorRef,
  placement = "inline",
}: {
  query: string;
  root?: string;
  onSelect: (hit: SearchHit) => void;
  className?: string;
  anchorRef?: RefObject<HTMLElement | null>;
  placement?: "inline" | "dropdown";
}) {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
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

  useLayoutEffect(() => {
    if (placement !== "dropdown" || !anchorRef?.current || query.trim().length < 2) {
      setDropdownStyle(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, placement, query, loading, results.length, error]);

  if (query.trim().length < 2) return null;

  const panel = (
    <SearchResultsPanel
      loading={loading}
      error={error}
      results={results}
      onSelect={onSelect}
      className={className}
    />
  );

  if (placement === "dropdown" && dropdownStyle) {
    return createPortal(
      <div
        className="fixed z-[100]"
        style={{
          top: dropdownStyle.top,
          left: dropdownStyle.left,
          width: dropdownStyle.width,
        }}
      >
        {panel}
      </div>,
      document.body,
    );
  }

  if (placement === "dropdown") return null;

  return panel;
}
