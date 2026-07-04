import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";

import { BibVerificationBadge } from "@/components/editor/BibVerificationBadge";
import { BibCrossrefDialog } from "@/components/editor/BibCrossrefDialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import {
  deleteBibEntries,
  previewBibEntryFromCrossref,
  saveBibEntry,
  searchCrossrefForBibEntry,
  updateBibEntryFromCrossref,
  verifyBibEntry,
  type BibLibraryEntry,
  type CrossrefCandidate,
} from "@/lib/paperAssets";
import { invalidateBibLibrary, patchBibLibraryEntry } from "@/lib/bibLibraryStore";
import { invalidateReferenceSearchCache } from "@/lib/referenceSearchCache";
import { entryToBibtex } from "@/lib/bibEntrySource";
import { validateBibEntryFields, validateCiteKey } from "@/lib/bibtexValidate";
import { cn } from "@/lib/utils";

const COMMON_FIELDS = ["title", "author", "year", "journal", "booktitle", "doi", "url"] as const;

function copyEntry(entry: BibLibraryEntry): BibLibraryEntry {
  return { ...entry, fields: { ...entry.fields } };
}

export function BibEntryEditor({
  entry,
  onError,
  onModelChanged,
  paperPath,
  onSaved,
  onDeleted,
}: {
  entry: BibLibraryEntry;
  onError: (message: string) => void;
  onModelChanged?: () => void;
  paperPath?: string | null;
  onSaved?: (entry: BibLibraryEntry) => void;
  onDeleted?: () => void;
}) {
  const [draft, setDraft] = useState(() => copyEntry(entry));
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [crossrefSearching, setCrossrefSearching] = useState(false);
  const [crossrefDialogOpen, setCrossrefDialogOpen] = useState(false);
  const [crossrefDialogMode, setCrossrefDialogMode] = useState<"candidates" | "compare">("candidates");
  const [crossrefCandidates, setCrossrefCandidates] = useState<CrossrefCandidate[]>([]);
  const [previewingDoi, setPreviewingDoi] = useState<string | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{
    candidate: CrossrefCandidate;
    oldEntry: BibLibraryEntry;
    newEntry: BibLibraryEntry;
  } | null>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [rawOpen, setRawOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(copyEntry(entry));
    setCrossrefCandidates([]);
    setCrossrefDialogOpen(false);
    setCrossrefDialogMode("candidates");
    setPendingReplacement(null);
    setNewFieldName("");
    setNewFieldValue("");
    setCopied(false);
  }, [entry]);

  const fieldNames = useMemo(() => {
    const names = new Set<string>(COMMON_FIELDS);
    Object.keys(draft.fields)
      .filter((field) => field !== "integrity")
      .sort()
      .forEach((field) => names.add(field));
    return [...names];
  }, [draft.fields]);

  // Raw BibTeX for the entry as currently saved in main.bib (unsaved edits are
  // not reflected — this is "the previous raw text of the entry").
  const rawBibtex = useMemo(() => {
    const { integrity: _integrity, ...fields } = entry.fields;
    return entryToBibtex({ ...entry, fields });
  }, [entry]);
  const validationWarnings = useMemo(
    () => [...validateCiteKey(entry.citeKey), ...validateBibEntryFields(entry.type, entry.fields)],
    [entry],
  );

  const refreshAfterChange = async (saved: BibLibraryEntry) => {
    patchBibLibraryEntry(saved);
    invalidateReferenceSearchCache(paperPath ?? undefined);
    onModelChanged?.();
    onSaved?.(saved);
  };

  const patchField = (field: string, value: string) => {
    setDraft((current) => ({ ...current, fields: { ...current.fields, [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveBibEntry(entry.citeKey, {
        nextCiteKey: draft.citeKey,
        type: draft.type,
        fields: draft.fields,
      });
      await refreshAfterChange(saved);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setSaving(true);
    try {
      const verified = await verifyBibEntry(entry.citeKey);
      await refreshAfterChange(verified);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteBibEntries([entry.citeKey]);
      invalidateBibLibrary();
      invalidateReferenceSearchCache(paperPath ?? undefined);
      onModelChanged?.();
      setDeleteConfirmOpen(false);
      onDeleted?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSearchCrossref = async () => {
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
    setPreviewingDoi(candidate.doi);
    try {
      const newEntry = await previewBibEntryFromCrossref(entry.citeKey, candidate.doi);
      setPendingReplacement({
        candidate,
        oldEntry: copyEntry(entry),
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
      await refreshAfterChange(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-4">
        <section className="rounded-md border border-border bg-background">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-sm">@{draft.citeKey}</span>
                <BibVerificationBadge status={draft.verifiedStatus} large />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {draft.fields.title || "Untitled BibTeX entry"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || crossrefSearching}
                onClick={() => void handleSearchCrossref()}
              >
                {crossrefSearching ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                )}
                Crossref
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void handleVerify()}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Verify
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
                <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Save
              </Button>
              {onDeleted ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
            </div>
          </div>

          {validationWarnings.length > 0 ? (
            <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <ul className="list-inside list-disc space-y-0.5">
                {validationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-3 p-4">
            <BibFieldInput label="Key" mono value={draft.citeKey} onChange={(value) => setDraft((c) => ({ ...c, citeKey: value }))} />
            <BibFieldInput label="Type" mono value={draft.type} onChange={(value) => setDraft((c) => ({ ...c, type: value }))} />
            {fieldNames.map((field) => (
              <BibFieldInput
                key={field}
                label={field}
                value={draft.fields[field] ?? ""}
                onChange={(value) => patchField(field, value)}
              />
            ))}

            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Add field</p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <BibFieldInput
                  label="Field"
                  mono
                  value={newFieldName}
                  placeholder="name"
                  onChange={setNewFieldName}
                  className="md:flex-1"
                />
                <BibFieldInput
                  label="Value"
                  value={newFieldValue}
                  placeholder="value"
                  onChange={setNewFieldValue}
                  className="md:flex-[2]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 self-end md:self-auto"
                  title="Add field"
                  aria-label="Add field"
                  disabled={!newFieldName.trim()}
                  onClick={() => {
                    const field = newFieldName.trim().toLowerCase();
                    if (!field) return;
                    patchField(field, newFieldValue);
                    setNewFieldName("");
                    setNewFieldValue("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {draft.integrity ? (
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                integrity {draft.integrity}
              </p>
            ) : null}

            <div className="border-t border-border pt-3">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={rawOpen}
                onClick={() => setRawOpen((v) => !v)}
              >
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", rawOpen && "rotate-180")}
                  aria-hidden="true"
                />
                Raw BibTeX entry
              </button>
              {rawOpen ? (
                <div className="mt-2 rounded-md border border-border bg-muted/30">
                  <div className="flex items-center justify-between border-b border-border px-2 py-1">
                    <span className="text-[10px] text-muted-foreground">As currently saved in main.bib</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[10px]"
                      onClick={() => {
                        void navigator.clipboard.writeText(rawBibtex);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-foreground">
                    {rawBibtex}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <BibCrossrefDialog
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
        onCancel={() => {
          if (saving) return;
          setCrossrefDialogOpen(false);
          setCrossrefDialogMode("candidates");
          setPendingReplacement(null);
          setPreviewingDoi(null);
        }}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete from main.bib?"
        message={`Permanently remove @${entry.citeKey} from main.bib? Citations in drafts will show as missing until you add a replacement.`}
        confirmLabel={saving ? "Deleting…" : "Delete"}
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!saving) setDeleteConfirmOpen(false);
        }}
      />
    </>
  );
}

function BibFieldInput({
  label,
  value,
  onChange,
  mono = false,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-2", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        className={cn(
          "h-8 min-w-0 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
          mono && "font-mono",
        )}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
