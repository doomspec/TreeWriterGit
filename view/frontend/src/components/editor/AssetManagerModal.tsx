import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Image, Loader2, Sigma, Table2, Upload, X } from "lucide-react";

import { CrossrefAddPanel } from "@/components/editor/CrossrefAddPanel";
import { BibEntryList, type BibListItem } from "@/components/editor/BibEntryList";
import { AssetSearchField } from "@/components/editor/AssetSearchField";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import {
  defaultEquationInsertMode,
  defaultFigureInsertMode,
  equationInsertSnippet,
  figureInsertSnippet,
  referenceInsertSnippet,
  tableInsertSnippet,
} from "@/lib/assetInsert";
import { filterPaperAssets } from "@/lib/assetSearch";
import { invalidateBibLibrary } from "@/lib/bibLibraryStore";
import type { FigureMetadata } from "@/lib/figures";
import {
  deleteBibEntries,
  fetchBibSearch,
  fetchPaperAssets,
  importReferencesFromBibtex,
  importZoteroLocalItems,
  searchZoteroLocal,
  slugifyAssetName,
  type EquationMetadata,
  type PaperAssetsBundle,
  type ReferenceMetadata,
  type TableMetadata,
  type ZoteroSearchHit,
  type BibLibraryEntry,
} from "@/lib/paperAssets";
import { invalidateReferenceSearchCache } from "@/lib/referenceSearchCache";
import { fetchSettings, type ZoteroLocalSettings } from "@/lib/settingsApi";
import { archiveNode, createNode } from "@/modelApi";
import { cn } from "@/lib/utils";

export type AssetManagerMode = "manage" | "insert";
export type AssetTab = "figures" | "tables" | "equations" | "references";
type ReferenceSubView = "library" | "add";
type ReferenceAddSource = "crossref" | "zotero" | "file";

const TAB_LABELS: Record<AssetTab, string> = {
  figures: "Figures",
  tables: "Tables",
  equations: "Equations",
  references: "References",
};

const ASSET_TAB_FOLDER: Record<Exclude<AssetTab, "references">, string> = {
  figures: "figures",
  tables: "tables",
  equations: "equations",
};

function pathMatchesAssetTab(path: string, tab: Exclude<AssetTab, "references">): boolean {
  return path.includes(`/${ASSET_TAB_FOLDER[tab]}/`);
}

function assetTabFromPath(path: string): Exclude<AssetTab, "references"> | null {
  if (path.includes("/figures/")) return "figures";
  if (path.includes("/tables/")) return "tables";
  if (path.includes("/equations/")) return "equations";
  return null;
}

function isEditableDraft(filePath: string | undefined): boolean {
  if (!filePath) return false;
  return filePath.endsWith("/draft.md") || filePath.endsWith("/outline.md");
}

function SelectedEntries({
  items,
  onRemove,
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Selected ({items.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ id, label }) => (
          <span
            key={id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-foreground"
          >
            <span className="truncate">{label}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
              aria-label={`Remove ${label}`}
              onClick={() => onRemove(id)}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function AssetManagerModal({
  open,
  mode,
  paperPath,
  initialTab = "figures",
  filePath,
  refreshVersion = 0,
  onClose,
  onError,
  onModelChanged,
  onInsert,
}: {
  open: boolean;
  mode: AssetManagerMode;
  paperPath: string;
  initialTab?: AssetTab;
  filePath?: string;
  refreshVersion?: number;
  onClose: () => void;
  onError: (message: string) => void;
  onModelChanged?: () => void;
  onInsert?: (snippet: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<AssetTab>(initialTab);
  const [refSubView, setRefSubView] = useState<ReferenceSubView>("library");
  const [refAddSource, setRefAddSource] = useState<ReferenceAddSource>("crossref");
  const [searchQuery, setSearchQuery] = useState("");
  const [assets, setAssets] = useState<PaperAssetsBundle | null>(null);
  const [bibEntries, setBibEntries] = useState<ReferenceMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [selectedPathLabels, setSelectedPathLabels] = useState<Map<string, string>>(() => new Map());
  const [selectedKeyLabels, setSelectedKeyLabels] = useState<Map<string, string>>(() => new Map());
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [zoteroSettings, setZoteroSettings] = useState<ZoteroLocalSettings | null>(null);
  const [zoteroQuery, setZoteroQuery] = useState("");
  const [zoteroHits, setZoteroHits] = useState<ZoteroSearchHit[]>([]);
  const [zoteroSearching, setZoteroSearching] = useState(false);
  const [selectedZoteroKeys, setSelectedZoteroKeys] = useState<Set<string>>(() => new Set());
  const [importing, setImporting] = useState(false);
  const bibFileRef = useRef<HTMLInputElement>(null);

  const figureMode = defaultFigureInsertMode(filePath ?? "");
  const equationMode = defaultEquationInsertMode(filePath ?? "");

  const resetSelection = useCallback(() => {
    setSelectedPaths(new Set());
    setSelectedKeys(new Set());
    setSelectedPathLabels(new Map());
    setSelectedKeyLabels(new Map());
    setSelectedZoteroKeys(new Set());
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setRefSubView("library");
    setRefAddSource("crossref");
    setSearchQuery("");
    setCreateName("");
    setZoteroQuery("");
    setZoteroHits([]);
    resetSelection();
  }, [initialTab, open, resetSelection]);

  useEffect(() => {
    if (!open) return;
    void fetchSettings()
      .then((settings) => setZoteroSettings(settings.zoteroLocal))
      .catch(() => setZoteroSettings(null));
  }, [open]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bundle, bib] = await Promise.all([
        fetchPaperAssets(paperPath),
        fetchBibSearch({ q: searchQuery.trim(), limit: 200 }),
      ]);
      setAssets(bundle);
      setBibEntries(bib.entries);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onError, paperPath, searchQuery]);

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [loadData, open, refreshVersion]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating && !deleting && !importing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating, deleting, importing, onClose, open]);

  const filteredAssets = useMemo(() => {
    const bundle = assets ?? { figures: [], tables: [], equations: [], referenceCount: 0 };
    return filterPaperAssets(bundle, searchQuery, []);
  }, [assets, searchQuery]);

  const allAssets = useMemo(() => {
    const bundle = assets ?? { figures: [], tables: [], equations: [], referenceCount: 0 };
    return filterPaperAssets(bundle, "", []);
  }, [assets]);

  const togglePath = (path: string, label: string) => {
    if (mode === "insert" && activeTab === "references") return;
    if (activeTab !== "references" && !pathMatchesAssetTab(path, activeTab)) return;

    const removing = selectedPaths.has(path);
    const nextPaths = new Set(selectedPaths);
    const nextLabels = new Map(selectedPathLabels);
    if (removing) {
      nextPaths.delete(path);
      nextLabels.delete(path);
    } else {
      if (mode === "insert") {
        const pathTab = assetTabFromPath(path);
        if (pathTab && pathTab !== activeTab) return;
        if (selectedPaths.size === 0) setSearchQuery("");
        setSelectedKeys(new Set());
        setSelectedKeyLabels(new Map());
      } else if (selectedPaths.size === 0) {
        setSearchQuery("");
      }
      nextPaths.add(path);
      nextLabels.set(path, label);
    }
    setSelectedPaths(nextPaths);
    setSelectedPathLabels(nextLabels);
  };

  const toggleKey = (citeKey: string, label: string) => {
    if (mode === "insert" && activeTab !== "references") return;

    const removing = selectedKeys.has(citeKey);
    const nextKeys = new Set(selectedKeys);
    const nextLabels = new Map(selectedKeyLabels);
    if (removing) {
      nextKeys.delete(citeKey);
      nextLabels.delete(citeKey);
    } else {
      if (mode === "insert") {
        if (selectedKeys.size === 0) setSearchQuery("");
        setSelectedPaths(new Set());
        setSelectedPathLabels(new Map());
      } else if (selectedKeys.size === 0) {
        setSearchQuery("");
      }
      nextKeys.add(citeKey);
      nextLabels.set(citeKey, label);
    }
    setSelectedKeys(nextKeys);
    setSelectedKeyLabels(nextLabels);
  };

  const toggleZoteroKey = (itemKey: string) => {
    setSelectedZoteroKeys((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  const handleModelRefresh = () => {
    invalidateBibLibrary();
    invalidateReferenceSearchCache(paperPath);
    onModelChanged?.();
    void loadData();
  };

  const handleCreate = async () => {
    const name = slugifyAssetName(createName);
    if (!name) {
      onError("Name is required");
      return;
    }
    setCreating(true);
    try {
      const folder =
        activeTab === "figures" ? "figures" : activeTab === "tables" ? "tables" : "equations";
      const kind =
        activeTab === "figures" ? "figure" : activeTab === "tables" ? "table" : "equation";
      await createNode(`${paperPath}/${folder}`, name, kind);
      setCreateName("");
      handleModelRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAssets = async () => {
    const paths = [...selectedPaths];
    if (paths.length === 0) return;
    setDeleting(true);
    setDeleteConfirmOpen(false);
    try {
      for (const assetPath of paths) {
        await archiveNode(assetPath);
      }
      resetSelection();
      handleModelRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteReferences = async () => {
    const keys = [...selectedKeys];
    if (keys.length === 0) return;
    setDeleting(true);
    setDeleteConfirmOpen(false);
    try {
      await deleteBibEntries(keys);
      resetSelection();
      handleModelRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleInsertAssets = () => {
    if (!onInsert || selectedPaths.size === 0 || activeTab === "references") return;
    const paths = [...selectedPaths];
    if (paths.some((path) => !pathMatchesAssetTab(path, activeTab))) {
      onError("Select items of one type only.");
      return;
    }
    const snippets: string[] = [];
    for (const path of paths) {
      if (activeTab === "figures") {
        const fig = allAssets.figures.find((f) => f.path === path);
        if (fig) snippets.push(figureInsertSnippet(fig.path, fig.title, figureMode));
      } else if (activeTab === "tables") {
        const table = allAssets.tables.find((t) => t.path === path);
        if (table) snippets.push(tableInsertSnippet(table.path, table.title));
      } else if (activeTab === "equations") {
        const eq = allAssets.equations.find((e) => e.path === path);
        if (eq) snippets.push(equationInsertSnippet(eq.path, eq.title, equationMode));
      }
    }
    if (snippets.length === 0) return;
    onInsert(snippets.join(""));
    onClose();
  };

  const handleInsertReferences = () => {
    if (!onInsert || selectedKeys.size === 0 || activeTab !== "references") return;
    if (selectedPaths.size > 0) {
      onError("Select citations only — clear figure, table, or equation selections first.");
      return;
    }
    onInsert(referenceInsertSnippet([...selectedKeys]));
    onClose();
  };

  const handleZoteroSearch = async () => {
    const q = zoteroQuery.trim();
    if (!q) return;
    setZoteroSearching(true);
    try {
      setZoteroHits(await searchZoteroLocal(q, 30));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setZoteroHits([]);
    } finally {
      setZoteroSearching(false);
    }
  };

  const handleZoteroImport = async () => {
    const keys = [...selectedZoteroKeys];
    if (keys.length === 0) return;
    setImporting(true);
    try {
      const result = await importZoteroLocalItems(keys);
      const added = [...result.created, ...result.citeKeys];
      resetSelection();
      if (added.length > 0) {
        setSelectedPaths(new Set());
        setSelectedPathLabels(new Map());
        setSelectedKeys(new Set(added));
        setSelectedKeyLabels(
          new Map(
            added.map((key) => {
              const hit = zoteroHits.find((h) => h.citeKey === key || h.itemKey === key);
              const label = hit?.title ? `@${key} — ${hit.title}` : `@${key}`;
              return [key, label] as const;
            }),
          ),
        );
        setSearchQuery("");
      }
      setRefSubView("library");
      setRefAddSource("crossref");
      handleModelRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleBibFile = async (file: File) => {
    setImporting(true);
    try {
      const bibtex = await file.text();
      const result = await importReferencesFromBibtex(paperPath, bibtex);
      if (result.created.length > 0) {
        setSelectedPaths(new Set());
        setSelectedPathLabels(new Map());
        setSelectedKeys(new Set(result.created));
        setSelectedKeyLabels(new Map(result.created.map((key) => [key, `@${key}`])));
        setSearchQuery("");
      }
      setRefSubView("library");
      handleModelRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      if (bibFileRef.current) bibFileRef.current.value = "";
    }
  };

  const handleCrossrefAdded = (entry: BibLibraryEntry) => {
    const title = entry.fields.title?.trim();
    const label = title ? `@${entry.citeKey} — ${title}` : `@${entry.citeKey}`;
    setSelectedPaths(new Set());
    setSelectedPathLabels(new Map());
    setSelectedKeys(new Set([entry.citeKey]));
    setSelectedKeyLabels(new Map([[entry.citeKey, label]]));
    setSearchQuery("");
    setRefSubView("library");
    handleModelRefresh();
  };

  const busy = loading || creating || deleting || importing;

  if (!open) return null;

  const canInsert = mode === "insert" && isEditableDraft(filePath) && Boolean(onInsert);

  const renderAssetList = (
    items: (FigureMetadata | TableMetadata | EquationMetadata)[],
    labelFn: (item: FigureMetadata | TableMetadata | EquationMetadata) => string,
    hintFn: (item: FigureMetadata | TableMetadata | EquationMetadata) => string | null,
  ) => (
    <ul className="max-h-[45vh] space-y-1 overflow-auto">
      {items.length === 0 ? (
        <li className="px-2 py-4 text-sm text-muted-foreground">No items match your search.</li>
      ) : (
        items.map((item) => {
          const selected = selectedPaths.has(item.path);
          return (
            <li key={item.path}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-sm hover:bg-accent/40",
                  selected ? "border-primary/40 bg-accent/50" : "border-transparent",
                )}
                onClick={() => togglePath(item.path, labelFn(item))}
              >
                <input type="checkbox" checked={selected} readOnly className="mt-0.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{labelFn(item)}</span>
                  {hintFn(item) ? (
                    <span className="block truncate text-xs text-muted-foreground">{hintFn(item)}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })
      )}
    </ul>
  );

  const bibListItems: BibListItem[] = bibEntries.map((entry) => ({
    citeKey: entry.citeKey,
    title: entry.title || entry.citeKey,
    subtitle: entry.authors ?? entry.year ?? entry.type ?? null,
    verifiedStatus: entry.verifiedStatus ?? "unverified",
    deletable: true,
  }));

  const referenceSelectionLabel = (citeKey: string) => {
    const entry = bibListItems.find((item) => item.citeKey === citeKey);
    return entry ? `@${entry.citeKey} — ${entry.title}` : `@${citeKey}`;
  };

  const handleToggleReference = (citeKey: string) => {
    toggleKey(citeKey, referenceSelectionLabel(citeKey));
  };

  const selectedAssetEntries = [...selectedPathLabels.entries()].map(([id, label]) => ({ id, label }));
  const selectedReferenceEntries = [...selectedKeyLabels.entries()].map(([id, label]) => ({ id, label }));

  const handleDeleteSingleReference = (citeKey: string) => {
    setSelectedKeys(new Set([citeKey]));
    setSelectedKeyLabels(new Map([[citeKey, referenceSelectionLabel(citeKey)]]));
    setDeleteConfirmOpen(true);
  };

  const deleteCount = activeTab === "references" ? selectedKeys.size : selectedPaths.size;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="asset-manager-title"
          className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 id="asset-manager-title" className="text-sm font-semibold">
              {mode === "insert" ? "Insert asset" : "Manage assets"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {(Object.keys(TAB_LABELS) as AssetTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    setActiveTab(tab);
                    resetSelection();
                    setRefSubView("library");
                  }}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {activeTab !== "references" ? (
              <div className="space-y-3">
                <AssetSearchField value={searchQuery} onChange={setSearchQuery} />
                <SelectedEntries
                  items={selectedAssetEntries}
                  onRemove={(path) => {
                    const label = selectedPathLabels.get(path) ?? path;
                    togglePath(path, label);
                  }}
                />
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : activeTab === "figures" ? (
                  renderAssetList(
                    filteredAssets.figures,
                    (f) => (f as FigureMetadata).figureLabel ?? f.title,
                    (f) => (f as FigureMetadata).caption || f.summary,
                  )
                ) : activeTab === "tables" ? (
                  renderAssetList(
                    filteredAssets.tables,
                    (t) => (t as TableMetadata).tableLabel ?? t.title,
                    (t) => (t as TableMetadata).caption || t.summary,
                  )
                ) : (
                  renderAssetList(
                    filteredAssets.equations,
                    (e) => (e as EquationMetadata).equationLabel ?? e.title,
                    (e) => (e as EquationMetadata).caption || e.summary,
                  )
                )}
                {mode === "manage" ? (
                  <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                    <label className="min-w-0 flex-1 text-xs">
                      <span className="mb-1 block text-muted-foreground">New {TAB_LABELS[activeTab].slice(0, -1).toLowerCase()} name</span>
                      <input
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={createName}
                        placeholder="my-asset"
                        disabled={busy}
                        onChange={(event) => setCreateName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void handleCreate();
                        }}
                      />
                    </label>
                    <Button type="button" size="sm" className="h-8" disabled={busy || !createName.trim()} onClick={() => void handleCreate()}>
                      {creating ? "Creating…" : "Create"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 text-xs",
                      refSubView === "library" ? "bg-muted font-medium" : "text-muted-foreground",
                    )}
                    onClick={() => setRefSubView("library")}
                  >
                    Library
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 text-xs",
                      refSubView === "add" ? "bg-muted font-medium" : "text-muted-foreground",
                    )}
                    onClick={() => setRefSubView("add")}
                  >
                    Add
                  </button>
                </div>
                {refSubView === "library" ? (
                  <>
                    <AssetSearchField value={searchQuery} onChange={setSearchQuery} />
                    <SelectedEntries
                      items={selectedReferenceEntries}
                      onRemove={(citeKey) => {
                        toggleKey(citeKey, selectedKeyLabels.get(citeKey) ?? `@${citeKey}`);
                      }}
                    />
                    {loading ? (
                      <p className="text-sm text-muted-foreground">Loading library…</p>
                    ) : (
                      <div className="max-h-[45vh] min-h-[12rem]">
                        <BibEntryList
                          items={bibListItems}
                          selectedKey={null}
                          onSelect={handleToggleReference}
                          selectionMode
                          checkedKeys={selectedKeys}
                          onToggleChecked={handleToggleReference}
                          onDelete={mode === "manage" ? handleDeleteSingleReference : undefined}
                          emptyLabel="No references in main.bib yet — use Add to import."
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {(["crossref", "zotero", "file"] as ReferenceAddSource[]).map((source) => (
                        <button
                          key={source}
                          type="button"
                          disabled={source === "zotero" && !zoteroSettings?.enabled}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs capitalize",
                            refAddSource === source ? "bg-muted font-medium" : "text-muted-foreground",
                            source === "zotero" && !zoteroSettings?.enabled ? "opacity-50" : "",
                          )}
                          onClick={() => setRefAddSource(source)}
                        >
                          {source === "file" ? "Upload .bib" : source}
                        </button>
                      ))}
                    </div>
                    {refAddSource === "crossref" ? (
                      <CrossrefAddPanel onAdded={handleCrossrefAdded} onError={onError} />
                    ) : refAddSource === "zotero" ? (
                      zoteroSettings?.enabled ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                              value={zoteroQuery}
                              placeholder="Search Zotero library…"
                              disabled={zoteroSearching || importing}
                              onChange={(event) => setZoteroQuery(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void handleZoteroSearch();
                              }}
                            />
                            <Button type="button" className="h-9 px-3 text-xs" disabled={zoteroSearching || !zoteroQuery.trim()} onClick={() => void handleZoteroSearch()}>
                              {zoteroSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
                            </Button>
                          </div>
                          <ul className="max-h-[35vh] space-y-1 overflow-auto">
                            {zoteroHits.map((hit) => (
                              <li key={hit.itemKey}>
                                <button
                                  type="button"
                                  className={cn(
                                    "flex w-full gap-2 rounded-md border px-2 py-2 text-left text-sm hover:bg-accent/40",
                                    selectedZoteroKeys.has(hit.itemKey) ? "border-primary/40 bg-accent/50" : "border-transparent",
                                  )}
                                  onClick={() => toggleZoteroKey(hit.itemKey)}
                                >
                                  <input type="checkbox" readOnly checked={selectedZoteroKeys.has(hit.itemKey)} className="mt-0.5" />
                                  <span className="min-w-0">
                                    <span className="block font-medium">{hit.title}</span>
                                    <span className="block text-xs text-muted-foreground">
                                      {[hit.authors, hit.year, hit.citeKey ? `@${hit.citeKey}` : null].filter(Boolean).join(" · ")}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                          <Button type="button" className="h-8 text-xs" disabled={importing || selectedZoteroKeys.size === 0} onClick={() => void handleZoteroImport()}>
                            {importing ? "Importing…" : `Import selected (${selectedZoteroKeys.size})`}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Enable local Zotero in Settings → Extensions.
                        </p>
                      )
                    ) : (
                      <div className="space-y-2">
                        <input ref={bibFileRef} type="file" accept=".bib,.txt" className="hidden" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleBibFile(file);
                        }} />
                        <Button type="button" variant="outline" className="h-9 gap-1.5 text-xs" disabled={importing} onClick={() => bibFileRef.current?.click()}>
                          <Upload className="h-3.5 w-3.5" />
                          Choose BibTeX file
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <div className="text-xs text-muted-foreground">
              {deleteCount > 0
                ? `${deleteCount} selected${mode === "insert" ? ` · ${TAB_LABELS[activeTab]} only` : ""}`
                : null}
              {canInsert && !isEditableDraft(filePath) ? "Open a draft to insert." : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-8 px-3 text-xs" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              {mode === "manage" && activeTab !== "references" && selectedPaths.size > 0 ? (
                <Button type="button" variant="outline" className="h-8 px-3 text-xs text-destructive hover:text-destructive" disabled={busy} onClick={() => setDeleteConfirmOpen(true)}>
                  Delete
                </Button>
              ) : null}
              {mode === "manage" && activeTab === "references" && refSubView === "library" && selectedKeys.size > 0 ? (
                <Button type="button" variant="outline" className="h-8 px-3 text-xs text-destructive hover:text-destructive" disabled={busy} onClick={() => setDeleteConfirmOpen(true)}>
                  Delete from library
                </Button>
              ) : null}
              {canInsert && activeTab !== "references" && selectedPaths.size > 0 ? (
                <Button type="button" className="h-8 px-3 text-xs" disabled={busy} onClick={handleInsertAssets}>
                  Insert
                </Button>
              ) : null}
              {canInsert && activeTab === "references" && refSubView === "library" && selectedKeys.size > 0 ? (
                <Button type="button" className="h-8 px-3 text-xs" disabled={busy} onClick={handleInsertReferences}>
                  Insert citations
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={activeTab === "references" ? "Delete from main.bib?" : "Move to Removed?"}
        message={
          activeTab === "references"
            ? `Remove ${selectedKeys.size} reference${selectedKeys.size === 1 ? "" : "s"} from main.bib?`
            : `Move ${selectedPaths.size} item${selectedPaths.size === 1 ? "" : "s"} to Removed?`
        }
        confirmLabel={activeTab === "references" ? "Delete" : "Move to Removed"}
        destructive
        onConfirm={() => void (activeTab === "references" ? handleDeleteReferences() : handleDeleteAssets())}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>,
    document.body,
  );
}

export function assetTabIcon(tab: AssetTab) {
  switch (tab) {
    case "figures":
      return Image;
    case "tables":
      return Table2;
    case "equations":
      return Sigma;
    case "references":
      return BookOpen;
  }
}
