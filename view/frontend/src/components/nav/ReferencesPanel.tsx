import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen } from "lucide-react";

import { AssetManagerModal } from "@/components/editor/AssetManagerModal";
import { AssetSearchField } from "@/components/editor/AssetSearchField";
import { BibEntryList, type BibListItem } from "@/components/editor/BibEntryList";
import { BibVerificationCounts } from "@/components/editor/BibVerificationBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import type { BibVerificationFilter } from "@/lib/bibEntrySearch";
import { filterReferences } from "@/lib/assetSearch";
import { invalidateBibLibrary } from "@/lib/bibLibraryStore";
import { deleteBibEntries, removeCitationFromDrafts, type ReferenceMetadata } from "@/lib/paperAssets";
import { ensureCitedReferences, invalidateReferenceSearchCache } from "@/lib/referenceSearchCache";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import { cn } from "@/lib/utils";

function toListItem(entry: ReferenceMetadata, inLibrary: boolean): BibListItem {
  return {
    citeKey: entry.citeKey,
    title: entry.title || entry.citeKey,
    subtitle: inLibrary
      ? (entry.authors ?? entry.year ?? entry.type ?? null)
      : "Missing from main.bib",
    verifiedStatus: entry.verifiedStatus ?? "unverified",
    deletable: inLibrary,
    missingFromLibrary: entry.missingFromLibrary,
  };
}

function citedSummary(references: ReferenceMetadata[]) {
  let verified = 0;
  let stale = 0;
  let unverified = 0;
  for (const reference of references) {
    const status = reference.verifiedStatus ?? "unverified";
    if (status === "verified") verified += 1;
    else if (status === "stale") stale += 1;
    else unverified += 1;
  }
  return { verified, stale, unverified, total: references.length };
}

export function ReferencesPanel({
  paperPath,
  activeFile: _activeFile,
  refreshVersion,
  onOpenFile,
  onModelChanged,
  onError,
}: {
  paperPath: string | null;
  activeFile: string | null;
  refreshVersion: number;
  onOpenFile: (path: string, options?: { citeKey?: string }) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
}) {
  const nav = useWorkspaceNavigationContext();
  const [references, setReferences] = useState<ReferenceMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BibVerificationFilter>("all");
  const [managerOpen, setManagerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [removeFromTextTarget, setRemoveFromTextTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const prevRefreshVersionRef = useRef(refreshVersion);

  const reloadCitedReferences = useCallback(async () => {
    if (!paperPath) {
      setReferences([]);
      return;
    }
    setLoading(true);
    try {
      invalidateReferenceSearchCache(paperPath);
      setReferences(await ensureCitedReferences(paperPath));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setReferences([]);
    } finally {
      setLoading(false);
    }
  }, [onError, paperPath]);

  useEffect(() => {
    void reloadCitedReferences();
  }, [reloadCitedReferences, refreshVersion]);

  useEffect(() => {
    if (prevRefreshVersionRef.current === refreshVersion) return;
    prevRefreshVersionRef.current = refreshVersion;
    invalidateBibLibrary();
  }, [refreshVersion]);

  const filteredEntries = useMemo(() => {
    let list = filterReferences(references, debouncedQuery);
    if (statusFilter !== "all") {
      list = list.filter((reference) => (reference.verifiedStatus ?? "unverified") === statusFilter);
    }
    return list;
  }, [debouncedQuery, references, statusFilter]);

  const summary = useMemo(() => citedSummary(references), [references]);

  const openEntry = useCallback(
    (citeKey: string) => {
      nav.setSelectedBibCiteKey(citeKey);
      onOpenFile("main.bib", { citeKey });
    },
    [nav, onOpenFile],
  );

  const handleDeleteEntry = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBibEntries([deleteTarget]);
      invalidateBibLibrary();
      invalidateReferenceSearchCache(paperPath ?? "");
      onModelChanged();
      if (nav.selectedBibCiteKey === deleteTarget) {
        nav.setSelectedBibCiteKey(null);
      }
      await reloadCitedReferences();
      setDeleteTarget(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, nav, onError, onModelChanged, paperPath, reloadCitedReferences]);

  const handleRemoveFromText = useCallback(async () => {
    if (!paperPath || !removeFromTextTarget) return;
    const citeKey = removeFromTextTarget;
    setDeleting(true);
    try {
      const result = await removeCitationFromDrafts(paperPath, citeKey);
      invalidateReferenceSearchCache(paperPath);
      onModelChanged();
      if (nav.selectedBibCiteKey === citeKey) {
        nav.setSelectedBibCiteKey(null);
      }
      await reloadCitedReferences();
      setRemoveFromTextTarget(null);
      if (result.modified.length === 0) {
        onError(`No [@${citeKey}] citations found in drafts.`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }, [nav, onError, onModelChanged, paperPath, reloadCitedReferences, removeFromTextTarget]);

  const isInLibrary = useCallback(
    (reference: ReferenceMetadata) => !reference.missingFromLibrary,
    [],
  );

  const listItems = useMemo(
    () =>
      filteredEntries.map((entry) => ({
        meta: entry,
        item: toListItem(entry, isInLibrary(entry)),
      })),
    [filteredEntries, isInLibrary],
  );

  if (!paperPath) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        Select a paper to see references cited in its drafts.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">References</p>
            <p className="text-[10px] text-muted-foreground">Cited in this paper</p>
          </div>
        </div>
        {summary.total > 0 ? (
          <BibVerificationCounts
            verified={summary.verified}
            stale={summary.stale}
            unverified={summary.unverified}
          />
        ) : null}
        <AssetSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search cited references…"
        />
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => setManagerOpen(true)}
        >
          Manage references…
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col" style={{ contentVisibility: "auto" }}>
        <p className="shrink-0 px-3 py-1 text-[10px] text-muted-foreground">
          {loading
            ? "Loading cited references…"
            : `${summary.total} cited reference${summary.total === 1 ? "" : "s"}${
                filteredEntries.length !== summary.total
                  ? ` · ${filteredEntries.length} shown`
                  : ""
              }`}
        </p>
        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-3">
            <p className="text-xs text-muted-foreground">Loading cited references…</p>
          </div>
        ) : (
          <BibEntryList
            items={listItems.map(({ item }) => item)}
            selectedKey={nav.selectedBibCiteKey}
            onSelect={openEntry}
            onDelete={(citeKey) => setDeleteTarget(citeKey)}
            onRemoveFromText={(citeKey) => setRemoveFromTextTarget(citeKey)}
            deletingKey={deleting ? (deleteTarget ?? removeFromTextTarget) : null}
            emptyLabel={
              summary.total === 0
                ? "No citations yet. Use [@citeKey] in drafts or manage references to add entries."
                : "No cited references match your search."
            }
          />
        )}
      </div>

      <AssetManagerModal
        open={managerOpen}
        mode="manage"
        paperPath={paperPath}
        initialTab="references"
        refreshVersion={refreshVersion}
        onClose={() => setManagerOpen(false)}
        onError={onError}
        onModelChanged={() => {
          onModelChanged();
          void reloadCitedReferences();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete from main.bib?"
        message={
          deleteTarget
            ? `Remove @${deleteTarget} from main.bib? This does not remove citations from drafts.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteEntry()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={removeFromTextTarget !== null}
        title="Remove from drafts?"
        message={
          removeFromTextTarget
            ? `Remove all [@${removeFromTextTarget}] citations from this paper's drafts? The entry is not in main.bib.`
            : ""
        }
        confirmLabel="Remove from text"
        destructive
        onConfirm={() => void handleRemoveFromText()}
        onCancel={() => {
          if (!deleting) setRemoveFromTextTarget(null);
        }}
      />
    </div>
  );
}
