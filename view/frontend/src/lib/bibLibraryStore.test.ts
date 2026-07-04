/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import {
  ensureBibLibrarySummary,
  invalidateBibLibrary,
  searchBibReferences,
  useBibLibrarySummary,
  useBibSearchResults,
} from "@/lib/bibLibraryStore";
import * as paperAssets from "@/lib/paperAssets";

describe("bibLibraryStore", () => {
  beforeEach(() => {
    invalidateBibLibrary();
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    cleanup();
    vi.restoreAllMocks();
    invalidateBibLibrary();
  });

  it("dedupes summary requests", async () => {
    const fetchSummary = vi.spyOn(paperAssets, "fetchBibLibrarySummary").mockResolvedValue({
      total: 2,
      verified: 1,
      stale: 0,
      unverified: 1,
      mtime: 1,
    });

    const [first, second] = await Promise.all([ensureBibLibrarySummary(), ensureBibLibrarySummary()]);
    expect(first.total).toBe(2);
    expect(second.total).toBe(2);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
  });

  it("dedupes search requests by cache key", async () => {
    vi.spyOn(paperAssets, "fetchBibSearch").mockResolvedValue({
      total: 1,
      entries: [
        {
          path: "main.bib#smith2024",
          citeKey: "smith2024",
          title: "Paper",
          authors: null,
          year: "2024",
          journal: null,
          type: "article",
          verifiedStatus: "unverified",
        },
      ],
    });

    const [first, second] = await Promise.all([
      searchBibReferences({ q: "smith", limit: 80 }),
      searchBibReferences({ q: "smith", limit: 80 }),
    ]);
    expect(first.entries).toHaveLength(1);
    expect(second.entries).toHaveLength(1);
    expect(paperAssets.fetchBibSearch).toHaveBeenCalledTimes(1);
  });

  it("keeps entries visible while the search query refreshes", async () => {
    vi.spyOn(paperAssets, "fetchBibSearch").mockResolvedValue({
      total: 1,
      entries: [
        {
          path: "main.bib#smith2024",
          citeKey: "smith2024",
          title: "Paper",
          authors: null,
          year: "2024",
          journal: null,
          type: "article",
          verifiedStatus: "unverified",
        },
      ],
    });

    const { result, rerender, unmount } = renderHook(
      ({ query }) => useBibSearchResults(query, "all", 500),
      { initialProps: { query: "smith" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);

    rerender({ query: "jones" });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.refreshing).toBe(true);

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(paperAssets.fetchBibSearch).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("reloads search results on invalidate but not on summary-only update", async () => {
    const fetchSearch = vi.spyOn(paperAssets, "fetchBibSearch").mockResolvedValue({
      total: 0,
      entries: [],
    });
    vi.spyOn(paperAssets, "fetchBibLibrarySummary").mockResolvedValue({
      total: 0,
      verified: 0,
      stale: 0,
      unverified: 0,
      mtime: 1,
    });

    const { result, unmount } = renderHook(() => useBibSearchResults("", "all", 500));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchSearch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await ensureBibLibrarySummary(true);
    });
    expect(fetchSearch).toHaveBeenCalledTimes(1);

    invalidateBibLibrary();
    await waitFor(() => expect(fetchSearch.mock.calls.length).toBeGreaterThan(1));
    unmount();
  });

  it("returns a stable reload callback from useBibLibrarySummary", () => {
    vi.spyOn(paperAssets, "fetchBibLibrarySummary").mockResolvedValue({
      total: 0,
      verified: 0,
      stale: 0,
      unverified: 0,
      mtime: 1,
    });

    const { result, rerender, unmount } = renderHook(() => useBibLibrarySummary());
    const firstReload = result.current.reload;
    rerender();
    expect(result.current.reload).toBe(firstReload);
    unmount();
  });
});
