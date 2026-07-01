import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

import { AssetSearchField } from "@/components/editor/AssetSearchField";
import { BibEntryEditor } from "@/components/editor/BibEntryEditor";
import { BibEntryList, type BibListItem } from "@/components/editor/BibEntryList";
import { BibVerificationCounts } from "@/components/editor/BibVerificationBadge";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import type { BibVerificationFilter } from "@/lib/bibEntrySearch";
import {
  ensureBibEntry,
  invalidateBibLibrary,
  searchBibReferences,
} from "@/lib/bibLibraryStore";
import { useBibLibrarySummary } from "@/lib/bibLibraryContext";
import { deleteBibEntries, type BibLibraryEntry, type ReferenceMetadata } from "@/lib/paperAssets";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useWindowWidth } from "@/lib/useWindowWidth";
import {
  clampBibPreviewSplit,
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  scheduleSaveWorkspacePreferences,
} from "@/lib/workspacePreferences";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import { cn } from "@/lib/utils";

function toListItem(entry: ReferenceMetadata): BibListItem {
  return {
    citeKey: entry.citeKey,
    title: entry.title || entry.citeKey,
    subtitle: entry.authors ?? entry.year ?? entry.type ?? null,
    verifiedStatus: entry.verifiedStatus ?? "unverified",
  };
}

export function BibFilePreview({
  filePath,
  onError,
  onModelChanged,
  paperPath,
  hideEntryList = false,
  headerActions,
}: {
  filePath: string;
  onError: (message: string) => void;
  onModelChanged?: () => void;
  paperPath?: string | null;
  hideEntryList?: boolean;
  headerActions?: React.ReactNode;
}) {
  const nav = useWorkspaceNavigationContext();
  const windowWidth = useWindowWidth();
  const { summary, loading: summaryLoading, reload: reloadSummary } = useBibLibrarySummary();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BibVerificationFilter>("all");
  const [listItems, setListItems] = useState<ReferenceMetadata[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(nav.selectedBibCiteKey);
  const [selectedEntry, setSelectedEntry] = useState<BibLibraryEntry | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entryRetryTick, setEntryRetryTick] = useState(0);
  const [previewSplit, setPreviewSplit] = useState(
    () => mergeWorkspaceDefaults(loadWorkspacePreferences()).bibPreviewSplit,
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const showInternalList = !hideEntryList && !(windowWidth < 1200 && nav.sidebarPanel === "references" && nav.sidebarPanelOpen);
  const compactPreviewList = showInternalList && windowWidth < 1024;
  const effectivePreviewSplit = compactPreviewList ? Math.min(previewSplit, 30) : previewSplit;

  const loadList = useCallback(async () => {
    if (hideEntryList) return;
    setListLoading(true);
    try {
      const result = await searchBibReferences({
        q: debouncedQuery,
        offset: 0,
        limit: 500,
        status: statusFilter,
      });
      setListItems(result.entries);
      setListTotal(result.total);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setListItems([]);
      setListTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [debouncedQuery, hideEntryList, onError, statusFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (hideEntryList) {
      setSelectedKey(nav.selectedBibCiteKey);
      return;
    }
    if (nav.selectedBibCiteKey) {
      setSelectedKey(nav.selectedBibCiteKey);
    }
  }, [hideEntryList, nav.selectedBibCiteKey]);

  useEffect(() => {
    if (hideEntryList) return;
    if (!selectedKey && listItems.length > 0) {
      const first = listItems[0]?.citeKey ?? null;
      if (first) {
        setSelectedKey(first);
        nav.setSelectedBibCiteKey(first);
      }
    }
  }, [hideEntryList, listItems, nav, selectedKey]);

  useEffect(() => {
    if (!selectedKey) {
      setSelectedEntry(null);
      setEntryError(null);
      return;
    }
    let cancelled = false;
    setEntryLoading(true);
    setEntryError(null);

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setEntryError("Entry load timed out. The library may be large — try again.");
        setEntryLoading(false);
      }
    }, 15_000);

    void ensureBibEntry(selectedKey)
      .then((entry) => {
        if (!cancelled) {
          setSelectedEntry(entry);
          setEntryError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEntryError(err instanceof Error ? err.message : String(err));
          setSelectedEntry(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setEntryLoading(false);
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [selectedKey, entryRetryTick]);

  const handleSelect = useCallback(
    (citeKey: string) => {
      setSelectedKey(citeKey);
      nav.setSelectedBibCiteKey(citeKey);
    },
    [nav],
  );

  const handleReload = useCallback(async () => {
    invalidateBibLibrary();
    await Promise.all([reloadSummary(), loadList()]);
    if (selectedKey) {
      const entry = await ensureBibEntry(selectedKey, true);
      setSelectedEntry(entry);
    }
  }, [loadList, reloadSummary, selectedKey]);

  const handlePreviewSplitChange = useCallback((percent: number) => {
    const next = clampBibPreviewSplit(percent);
    setPreviewSplit(next);
    scheduleSaveWorkspacePreferences({ bibPreviewSplit: next });
  }, []);

  const deletableKeys = useMemo(
    () => listItems.map((entry) => entry.citeKey),
    [listItems],
  );

  const toggleChecked = useCallback((citeKey: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(citeKey)) next.delete(citeKey);
      else next.add(citeKey);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setCheckedKeys(new Set());
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const keys = [...checkedKeys];
    if (keys.length === 0) return;
    setDeleting(true);
    try {
      const result = await deleteBibEntries(keys);
      invalidateBibLibrary();
      onModelChanged?.();
      await Promise.all([reloadSummary(), loadList()]);
      exitSelectionMode();
      setDeleteConfirmOpen(false);
      if (selectedKey && result.deleted.includes(selectedKey)) {
        setSelectedKey(null);
        nav.setSelectedBibCiteKey(null);
        setSelectedEntry(null);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }, [
    checkedKeys,
    exitSelectionMode,
    listItems,
    loadList,
    nav,
    onError,
    onModelChanged,
    reloadSummary,
    selectedKey,
  ]);

  const listPane = (
    <aside className="flex min-h-0 min-w-0 flex-col border-border bg-sidebar/60">
      <div className="sticky top-0 z-10 shrink-0 space-y-2 border-b border-border bg-sidebar px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">main.bib</span>
          <span className="text-[10px] text-muted-foreground">
            {summaryLoading ? "…" : `${listTotal} entr${listTotal === 1 ? "y" : "ies"}`}
          </span>
        </div>
        {summary ? (
          <BibVerificationCounts
            verified={summary.verified}
            stale={summary.stale}
            unverified={summary.unverified}
          />
        ) : null}
        <AssetSearchField value={searchQuery} onChange={setSearchQuery} placeholder="Filter entries…" />
        <div className="flex flex-wrap gap-1">
          {selectionMode ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px]"
                disabled={deleting}
                onClick={exitSelectionMode}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px]"
                disabled={deleting || deletableKeys.length === 0}
                onClick={() => setCheckedKeys(new Set(deletableKeys))}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-[10px]"
                disabled={deleting || checkedKeys.size === 0}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" />
                Delete ({checkedKeys.size})
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              disabled={listLoading || listTotal === 0}
              onClick={() => setSelectionMode(true)}
            >
              Select
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", "unverified", "stale", "verified"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] capitalize",
                statusFilter === filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
              onClick={() => setStatusFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
      <BibEntryList
        items={listItems.map(toListItem)}
        selectedKey={selectedKey}
        onSelect={handleSelect}
        selectionMode={selectionMode}
        checkedKeys={checkedKeys}
        onToggleChecked={toggleChecked}
        emptyLabel={listLoading ? "Loading references..." : "No BibTeX entries match."}
      />
    </aside>
  );

  const detailPane = (
    <main className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-5">
      {entryLoading ? (
        <div className="flex flex-col items-start gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Loading <span className="font-mono">@{selectedKey}</span>…
          </p>
        </div>
      ) : entryError ? (
        <div className="flex max-w-md flex-col gap-3">
          <p className="text-sm text-destructive">{entryError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setEntryRetryTick((n) => n + 1)}>
            Retry
          </Button>
        </div>
      ) : selectedEntry ? (
        <BibEntryEditor
          entry={selectedEntry}
          onError={onError}
          onModelChanged={onModelChanged}
          paperPath={paperPath}
          onSaved={(saved) => {
            setSelectedEntry(saved);
            if (saved.citeKey !== selectedKey) {
              setSelectedKey(saved.citeKey);
              nav.setSelectedBibCiteKey(saved.citeKey);
            }
            void Promise.all([reloadSummary(), loadList()]);
          }}
          onDeleted={() => {
            invalidateBibLibrary();
            onModelChanged?.();
            setSelectedKey(null);
            nav.setSelectedBibCiteKey(null);
            setSelectedEntry(null);
            void Promise.all([reloadSummary(), loadList()]);
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {hideEntryList
            ? "Select a reference from the sidebar."
            : listLoading
              ? "Loading BibTeX…"
              : "Select a BibTeX entry."}
        </p>
      )}
    </main>
  );

  const previewBody = useMemo(() => {
    if (!showInternalList) {
      return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{detailPane}</div>;
    }
    return (
      <ResizableDualPane
        splitPercent={effectivePreviewSplit}
        onSplitChange={handlePreviewSplitChange}
        className="min-h-0 min-w-0 flex-1"
        minPercent={compactPreviewList ? 18 : 20}
        maxPercent={compactPreviewList ? 32 : 45}
        left={listPane}
        right={detailPane}
      />
    );
  }, [compactPreviewList, detailPane, effectivePreviewSplit, handlePreviewSplitChange, listPane, previewSplit, showInternalList]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-reading">
      <div className="ui-pane-header shrink-0">
        <span className="ui-pane-header__label">BibTeX preview</span>
        <div className="ui-pane-header__actions">
          <span className="hidden font-mono text-ui-2xs text-muted-foreground sm:inline">{filePath}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Reload BibTeX"
            aria-label="Reload BibTeX"
            disabled={summaryLoading || listLoading || entryLoading}
            onClick={() => void handleReload()}
          >
            <RefreshCw
              className={cn("h-3 w-3", (summaryLoading || listLoading) && "animate-spin")}
              aria-hidden="true"
            />
          </Button>
          {headerActions}
        </div>
      </div>
      {previewBody}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete references from main.bib?"
        message={
          checkedKeys.size === 1
            ? `Permanently remove @${[...checkedKeys][0]} from main.bib? Citations in drafts will show as missing until you add a replacement.`
            : `Permanently remove ${checkedKeys.size} entries from main.bib? Citations in drafts may show as missing until you add replacements.`
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        destructive
        onConfirm={() => void handleDeleteSelected()}
        onCancel={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
}
