import { useCallback, useEffect, useState } from "react";

import type { BibVerificationFilter } from "@/lib/bibEntrySearch";
import {
  fetchBibEntry,
  fetchBibLibrarySummary,
  fetchBibSearch,
  type BibLibraryEntry,
  type MainBibSummary,
  type ReferenceMetadata,
} from "@/lib/paperAssets";

const BIB_LIBRARY_UPDATE_EVENT = "treewriter:bib-library-update";
const BIB_LIBRARY_INVALIDATE_EVENT = "treewriter:bib-library-invalidate";

export type BibSearchResult = {
  entries: ReferenceMetadata[];
  total: number;
};

let cachedSummary: MainBibSummary | null = null;
let summaryInflight: Promise<MainBibSummary> | null = null;

const entryCache = new Map<string, BibLibraryEntry>();
const entryInflight = new Map<string, Promise<BibLibraryEntry>>();

const searchCache = new Map<string, BibSearchResult>();
const searchInflight = new Map<string, Promise<BibSearchResult>>();

function searchCacheKey(
  q: string,
  offset: number,
  limit: number,
  status: BibVerificationFilter,
): string {
  return `${status}|${offset}|${limit}|${q.trim().toLowerCase()}`;
}

function emitBibLibraryUpdate(): void {
  window.dispatchEvent(new CustomEvent(BIB_LIBRARY_UPDATE_EVENT));
}

function emitBibLibraryInvalidate(): void {
  window.dispatchEvent(new CustomEvent(BIB_LIBRARY_INVALIDATE_EVENT));
}

export function invalidateBibLibrary(): void {
  cachedSummary = null;
  summaryInflight = null;
  entryCache.clear();
  entryInflight.clear();
  searchCache.clear();
  searchInflight.clear();
  emitBibLibraryUpdate();
  emitBibLibraryInvalidate();
}

export function patchBibLibraryEntry(entry: BibLibraryEntry): void {
  entryCache.set(entry.citeKey, entry);
  cachedSummary = null;
  searchCache.clear();
  searchInflight.clear();
  emitBibLibraryUpdate();
  emitBibLibraryInvalidate();
}

export async function ensureBibLibrarySummary(force = false): Promise<MainBibSummary> {
  if (!force && cachedSummary) return cachedSummary;
  if (!force && summaryInflight) return summaryInflight;

  const load = fetchBibLibrarySummary()
    .then((summary) => {
      cachedSummary = summary;
      summaryInflight = null;
      emitBibLibraryUpdate();
      return summary;
    })
    .catch((err) => {
      summaryInflight = null;
      throw err;
    });

  summaryInflight = load;
  return load;
}

export function getCachedBibLibrarySummary(): MainBibSummary | null {
  return cachedSummary;
}

export function getCachedBibEntry(citeKey: string): BibLibraryEntry | null {
  return entryCache.get(citeKey) ?? null;
}

export async function ensureBibEntry(citeKey: string, force = false): Promise<BibLibraryEntry> {
  if (!force && entryCache.has(citeKey)) {
    return entryCache.get(citeKey)!;
  }
  const pending = entryInflight.get(citeKey);
  if (!force && pending) return pending;

  const load = fetchBibEntry(citeKey)
    .then((entry) => {
      entryCache.set(entry.citeKey, entry);
      entryInflight.delete(citeKey);
      return entry;
    })
    .catch((err) => {
      entryInflight.delete(citeKey);
      throw err;
    });

  entryInflight.set(citeKey, load);
  return load;
}

export async function searchBibReferences(
  options: {
    q?: string;
    offset?: number;
    limit?: number;
    status?: BibVerificationFilter;
    force?: boolean;
  } = {},
): Promise<BibSearchResult> {
  const q = options.q ?? "";
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 80;
  const status = options.status ?? "all";
  const key = searchCacheKey(q, offset, limit, status);

  if (!options.force && searchCache.has(key)) {
    return searchCache.get(key)!;
  }
  const pending = searchInflight.get(key);
  if (!options.force && pending) return pending;

  const load = fetchBibSearch({ q, offset, limit, status })
    .then((result) => {
      searchCache.set(key, result);
      searchInflight.delete(key);
      return result;
    })
    .catch((err) => {
      searchInflight.delete(key);
      throw err;
    });

  searchInflight.set(key, load);
  return load;
}

export function subscribeBibLibrary(listener: () => void): () => void {
  window.addEventListener(BIB_LIBRARY_UPDATE_EVENT, listener);
  return () => window.removeEventListener(BIB_LIBRARY_UPDATE_EVENT, listener);
}

export function subscribeBibLibraryInvalidate(listener: () => void): () => void {
  window.addEventListener(BIB_LIBRARY_INVALIDATE_EVENT, listener);
  return () => window.removeEventListener(BIB_LIBRARY_INVALIDATE_EVENT, listener);
}

export function useBibLibrarySummary(): {
  summary: MainBibSummary | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [summary, setSummary] = useState<MainBibSummary | null>(() => getCachedBibLibrarySummary());
  const [loading, setLoading] = useState(() => !cachedSummary);

  const reload = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setSummary(await ensureBibLibrarySummary(force));
    } finally {
      setLoading(false);
    }
  }, []);

  const forceReload = useCallback(async () => {
    await reload(true);
  }, [reload]);

  useEffect(() => {
    // Fire-and-forget: nothing here awaits reload()'s result, so a rejected
    // fetch (e.g. offline/no backend) would otherwise surface as an
    // unhandled promise rejection. reload() itself still rejects normally
    // for callers that explicitly await it (e.g. the manual reload button).
    reload().catch(() => {});
    const applyCached = () => {
      setSummary(getCachedBibLibrarySummary());
    };
    const unsubUpdate = subscribeBibLibrary(applyCached);
    const unsubInvalidate = subscribeBibLibraryInvalidate(() => {
      reload(true).catch(() => {});
    });
    return () => {
      unsubUpdate();
      unsubInvalidate();
    };
  }, [reload]);

  return { summary, loading, reload: forceReload };
}

export function useBibSearchResults(
  query: string,
  status: BibVerificationFilter,
  limit = 500,
): {
  entries: ReferenceMetadata[];
  total: number;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
} {
  const [entries, setEntries] = useState<ReferenceMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await searchBibReferences({ q: query, offset: 0, limit, status, force: true });
      setEntries(result.entries);
      setTotal(result.total);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [limit, query, status]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    void searchBibReferences({ q: query, offset: 0, limit, status })
      .then((result) => {
        if (cancelled) return;
        setEntries(result.entries);
        setTotal(result.total);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) {
          setRefreshing(false);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [limit, query, status]);

  useEffect(() => subscribeBibLibraryInvalidate(() => void reload()), [reload]);

  return { entries, total, loading, refreshing, reload };
}
