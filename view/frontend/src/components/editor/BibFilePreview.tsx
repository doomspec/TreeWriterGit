import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchBibLibrary,
  previewBibEntryFromCrossref,
  saveBibEntry,
  searchCrossrefForBibEntry,
  updateBibEntryFromCrossref,
  verifyBibEntry,
  type BibLibraryEntry,
  type CrossrefCandidate,
} from "@/lib/paperAssets";
import { invalidateReferenceSearchCache } from "@/lib/referenceSearchCache";
import { cn } from "@/lib/utils";

type VerificationStatus = BibLibraryEntry["verifiedStatus"];
type PendingReplacement = {
  candidate: CrossrefCandidate;
  oldEntry: BibLibraryEntry;
  newEntry: BibLibraryEntry;
};
type CrossrefDialogMode = "candidates" | "compare";

const COMMON_FIELDS = ["title", "author", "year", "journal", "booktitle", "doi", "url"] as const;

function VerificationBadge({ status, large = false }: { status: VerificationStatus; large?: boolean }) {
  const Icon =
    status === "verified" ? ShieldCheck : status === "stale" ? ShieldAlert : ShieldQuestion;
  const label = status === "verified" ? "Verified" : status === "stale" ? "Stale" : "Unverified";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border font-medium uppercase tracking-normal",
        large ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[9px]",
        status === "verified" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "stale" &&
          "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        status === "unverified" &&
          "border-border bg-muted/40 text-muted-foreground",
      )}
      title={label}
    >
      <Icon className={large ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden="true" />
      {label}
    </span>
  );
}

function copyEntry(entry: BibLibraryEntry): BibLibraryEntry {
  return { ...entry, fields: { ...entry.fields } };
}

function formatBibValue(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function entryToBibtex(entry: BibLibraryEntry): string {
  const fields = Object.entries(entry.fields).sort(([a], [b]) => a.localeCompare(b));
  return [
    `@${entry.type}{${entry.citeKey},`,
    ...fields.map(([key, value]) => `  ${key} = {${formatBibValue(value)}},`),
    "}",
  ].join("\n");
}

function CrossrefDialog({
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
  mode: CrossrefDialogMode;
  candidates: CrossrefCandidate[];
  replacement: PendingReplacement | null;
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

export function BibFilePreview({
  filePath,
  onError,
  onModelChanged,
  paperPath,
}: {
  filePath: string;
  onError: (message: string) => void;
  onModelChanged?: () => void;
  paperPath?: string | null;
}) {
  const [entries, setEntries] = useState<BibLibraryEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<BibLibraryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crossrefSearching, setCrossrefSearching] = useState(false);
  const [crossrefDialogOpen, setCrossrefDialogOpen] = useState(false);
  const [crossrefDialogMode, setCrossrefDialogMode] = useState<CrossrefDialogMode>("candidates");
  const [crossrefCandidates, setCrossrefCandidates] = useState<CrossrefCandidate[]>([]);
  const [previewingDoi, setPreviewingDoi] = useState<string | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<PendingReplacement | null>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  const loadEntries = useCallback(
    async (nextSelected?: string) => {
      setLoading(true);
      try {
        const nextEntries = await fetchBibLibrary();
        setEntries(nextEntries);
        setSelectedKey((current) => {
          if (nextSelected && nextEntries.some((entry) => entry.citeKey === nextSelected)) return nextSelected;
          if (current && nextEntries.some((entry) => entry.citeKey === current)) return current;
          return nextEntries[0]?.citeKey ?? null;
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
        setEntries([]);
        setSelectedKey(null);
      } finally {
        setLoading(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const selected = selectedKey
      ? entries.find((entry) => entry.citeKey === selectedKey) ?? null
      : null;
    setDraft(selected ? copyEntry(selected) : null);
    setCrossrefCandidates([]);
    setCrossrefDialogOpen(false);
    setCrossrefDialogMode("candidates");
    setPendingReplacement(null);
    setNewFieldName("");
    setNewFieldValue("");
  }, [entries, selectedKey]);

  const verificationCounts = useMemo(
    () =>
      entries.reduce(
        (counts, entry) => {
          counts[entry.verifiedStatus] += 1;
          return counts;
        },
        { verified: 0, stale: 0, unverified: 0 } as Record<VerificationStatus, number>,
      ),
    [entries],
  );

  const fieldNames = useMemo(() => {
    if (!draft) return [...COMMON_FIELDS];
    const names = new Set<string>(COMMON_FIELDS);
    Object.keys(draft.fields)
      .filter((field) => field !== "integrity")
      .sort()
      .forEach((field) => names.add(field));
    return [...names];
  }, [draft]);

  const savedSelectedEntry = useMemo(
    () => (selectedKey ? entries.find((entry) => entry.citeKey === selectedKey) ?? null : null),
    [entries, selectedKey],
  );

  const refreshAfterChange = useCallback(
    async (nextSelected: string) => {
      invalidateReferenceSearchCache(paperPath ?? undefined);
      onModelChanged?.();
      await loadEntries(nextSelected);
    },
    [loadEntries, onModelChanged, paperPath],
  );

  const patchField = (field: string, value: string) => {
    setDraft((current) =>
      current ? { ...current, fields: { ...current.fields, [field]: value } } : current,
    );
  };

  const handleAddField = () => {
    const field = newFieldName.trim().toLowerCase();
    if (!field || !draft) return;
    patchField(field, newFieldValue);
    setNewFieldName("");
    setNewFieldValue("");
  };

  const handleSave = async () => {
    if (!draft || !selectedKey) return;
    setSaving(true);
    try {
      const saved = await saveBibEntry(selectedKey, {
        nextCiteKey: draft.citeKey,
        type: draft.type,
        fields: draft.fields,
      });
      await refreshAfterChange(saved.citeKey);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedKey) return;
    setSaving(true);
    try {
      const verified = await verifyBibEntry(selectedKey);
      await refreshAfterChange(verified.citeKey);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSearchCrossref = async () => {
    if (!draft) return;
    setCrossrefDialogOpen(true);
    setCrossrefDialogMode("candidates");
    setPendingReplacement(null);
    setCrossrefSearching(true);
    try {
      setCrossrefCandidates(await searchCrossrefForBibEntry(draft.fields.title || draft.citeKey));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setCrossrefSearching(false);
    }
  };

  const handlePreviewCrossrefReplacement = async (candidate: CrossrefCandidate) => {
    const oldEntry = savedSelectedEntry ?? draft;
    if (!selectedKey || !oldEntry) return;
    setPreviewingDoi(candidate.doi);
    try {
      const newEntry = await previewBibEntryFromCrossref(selectedKey, candidate.doi);
      setPendingReplacement({
        candidate,
        oldEntry: copyEntry(oldEntry),
        newEntry: copyEntry(newEntry),
      });
      setCrossrefDialogMode("compare");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewingDoi(null);
    }
  };

  const handleConfirmCrossrefReplacement = async () => {
    if (!pendingReplacement) return;
    setSaving(true);
    try {
      const updated = await updateBibEntryFromCrossref(
        pendingReplacement.oldEntry.citeKey,
        pendingReplacement.candidate.doi,
      );
      setPendingReplacement(null);
      setCrossrefDialogOpen(false);
      setCrossrefDialogMode("candidates");
      setCrossrefCandidates([]);
      await refreshAfterChange(updated.citeKey);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const closeCrossrefDialog = () => {
    if (saving) return;
    setCrossrefDialogOpen(false);
    setCrossrefDialogMode("candidates");
    setPendingReplacement(null);
    setPreviewingDoi(null);
  };

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col bg-reading">
      <div className="ui-pane-header shrink-0">
        <span className="ui-label truncate">BibTeX preview</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden font-mono text-ui-2xs text-muted-foreground sm:inline">
            {filePath}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Reload BibTeX"
            aria-label="Reload BibTeX"
            disabled={loading || saving}
            onClick={() => void loadEntries(selectedKey ?? undefined)}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 bg-background/20 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
        <aside className="max-h-64 min-h-0 overflow-auto border-b border-border bg-sidebar/60 lg:max-h-none lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 border-b border-border bg-sidebar px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">main.bib</span>
              <span className="text-[10px] text-muted-foreground">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
              <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1 text-emerald-700 dark:text-emerald-300">
                {verificationCounts.verified} verified
              </span>
              <span className="rounded-sm border border-amber-500/35 bg-amber-500/10 px-1.5 py-1 text-amber-700 dark:text-amber-300">
                {verificationCounts.stale} stale
              </span>
              <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-1 text-muted-foreground">
                {verificationCounts.unverified} open
              </span>
            </div>
          </div>

          {entries.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              {loading ? "Loading references..." : "No BibTeX entries in main.bib."}
            </p>
          ) : (
            <ul className="space-y-1 p-2">
              {entries.map((entry) => (
                <li key={entry.citeKey}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full min-w-0 flex-col gap-1 rounded-md border px-2 py-2 text-left hover:bg-accent/40",
                      selectedKey === entry.citeKey
                        ? "border-primary/40 bg-accent/50"
                        : "border-transparent text-muted-foreground",
                    )}
                    onClick={() => setSelectedKey(entry.citeKey)}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-mono text-[11px]">@{entry.citeKey}</span>
                      <VerificationBadge status={entry.verifiedStatus} />
                    </span>
                    <span className="line-clamp-2 text-[11px]">
                      {entry.fields.title || entry.citeKey}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground/80">
                      {entry.fields.author ?? entry.fields.year ?? entry.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="min-h-0 overflow-auto px-6 py-5">
          {draft ? (
            <div className="mx-auto flex max-w-5xl flex-col gap-4">
              <section className="rounded-md border border-border bg-background">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-sm">@{draft.citeKey}</span>
                      <VerificationBadge status={draft.verifiedStatus} large />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {draft.fields.title || "Untitled BibTeX entry"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || crossrefSearching}
                      onClick={handleSearchCrossref}
                    >
                      {crossrefSearching ? (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Crossref
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={handleVerify}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Verify
                    </Button>
                    <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
                      <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Save
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Key</label>
                    <input
                      className="h-8 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={draft.citeKey}
                      onChange={(event) =>
                        setDraft((current) =>
                          current ? { ...current, citeKey: event.target.value } : current,
                        )
                      }
                    />
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <input
                      className="h-8 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={draft.type}
                      onChange={(event) =>
                        setDraft((current) =>
                          current ? { ...current, type: event.target.value } : current,
                        )
                      }
                    />
                    {fieldNames.map((field) => (
                      <label key={field} className="contents">
                        <span className="text-xs font-medium text-muted-foreground">{field}</span>
                        <input
                          className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={draft.fields[field] ?? ""}
                          onChange={(event) => patchField(field, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-[7rem_minmax(0,0.45fr)_minmax(0,1fr)_auto] items-center gap-2 border-t border-border pt-3">
                    <span className="text-xs font-medium text-muted-foreground">Field</span>
                    <input
                      className="h-8 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="name"
                      value={newFieldName}
                      onChange={(event) => setNewFieldName(event.target.value)}
                    />
                    <input
                      className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="value"
                      value={newFieldValue}
                      onChange={(event) => setNewFieldValue(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      title="Add field"
                      aria-label="Add field"
                      disabled={!newFieldName.trim()}
                      onClick={handleAddField}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>

                  {draft.integrity ? (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      integrity {draft.integrity}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading BibTeX..." : "Select a BibTeX entry."}
            </p>
          )}
        </main>
      </div>
    </div>
    <CrossrefDialog
      open={crossrefDialogOpen}
      mode={crossrefDialogMode}
      candidates={crossrefCandidates}
      replacement={pendingReplacement}
      loadingCandidates={crossrefSearching}
      previewingDoi={previewingDoi}
      busy={saving}
      onSelectCandidate={(candidate) => void handlePreviewCrossrefReplacement(candidate)}
      onBack={() => {
        if (!saving) {
          setPendingReplacement(null);
          setCrossrefDialogMode("candidates");
        }
      }}
      onConfirm={() => void handleConfirmCrossrefReplacement()}
      onCancel={closeCrossrefDialog}
    />
    </>
  );
}
