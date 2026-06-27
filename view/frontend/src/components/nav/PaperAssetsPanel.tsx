import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Image,
  Plus,
  Sigma,
  Table2,
  Upload,
} from "lucide-react";

import { TreeRowActions } from "@/components/nav/TreeRowActions";
import { AssetSearchField } from "@/components/editor/AssetSearchField";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import {
  fetchPaperAssets,
  importReferencesFromBibtex,
  slugifyAssetName,
  type EquationMetadata,
  type PaperAssetsBundle,
  type ReferenceMetadata,
  type TableMetadata,
} from "@/lib/paperAssets";
import { filterPaperAssets, filteredAssetCount, totalAssetCount } from "@/lib/assetSearch";
import { ensureReferenceIndex, invalidateReferenceSearchCache, searchReferences } from "@/lib/referenceSearchCache";
import { navigateAfterArchive, useArchiveNodeDialog } from "@/lib/useArchiveNodeDialog";
import type { FigureMetadata } from "@/lib/figures";
import { cn } from "@/lib/utils";
import { createNode } from "@/modelApi";

type CreateKind = "figure" | "table" | "equation";

function AssetGroup({
  title,
  icon: Icon,
  emptyLabel,
  count,
  countLabel,
  active,
  onOpen,
  onAdd,
  addIcon: AddIcon = Plus,
  addTitle,
  collapsible = false,
  defaultExpanded = true,
  children,
}: {
  title: string;
  icon: typeof Image;
  emptyLabel: string;
  count: number;
  countLabel?: string;
  active?: boolean;
  onOpen: () => void;
  onAdd: () => void;
  addIcon?: typeof Plus;
  addTitle?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const body =
    count > 0 ? (
      <ul className="mt-1 space-y-0.5 px-2 pb-2">{children}</ul>
    ) : (
      <p className="px-3 pb-2 pt-1 text-[11px] text-muted-foreground">{emptyLabel}</p>
    );

  if (collapsible) {
    return (
      <details
        className="group/asset border-b border-border/60 px-2 last:border-b-0"
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary
          className={cn(
            "mx-1 flex cursor-pointer list-none items-stretch gap-0.5 rounded-md border border-border/60 bg-background [&::-webkit-details-marker]:hidden",
            active ? "border-primary/40 bg-accent/50" : undefined,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <span className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/asset:rotate-90" aria-hidden="true" />
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-medium">{title}</span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {countLabel ?? (count > 0 ? `${count} item${count === 1 ? "" : "s"}` : "Empty")}
            </span>
          </span>
          <div className="flex shrink-0 items-center pr-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title={addTitle ?? `New ${title.toLowerCase().replace(/s$/, "")}`}
              aria-label={addTitle ?? `New ${title.toLowerCase().replace(/s$/, "")}`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAdd();
              }}
            >
              <AddIcon className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        </summary>
        {body}
      </details>
    );
  }

  return (
    <div className="border-b border-border/60 px-2 last:border-b-0">
      <div
        className={cn(
          "mx-1 flex items-stretch gap-0.5 rounded-md border border-border/60 bg-background",
          active ? "border-primary/40 bg-accent/50" : undefined,
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/40"
          onClick={onOpen}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-medium">{title}</span>
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {countLabel ?? (count > 0 ? `${count} item${count === 1 ? "" : "s"}` : "Empty")}
          </span>
        </button>
        <div className="flex shrink-0 items-center pr-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={addTitle ?? `New ${title.toLowerCase().replace(/s$/, "")}`}
            aria-label={addTitle ?? `New ${title.toLowerCase().replace(/s$/, "")}`}
            onClick={(event) => {
              event.stopPropagation();
              onAdd();
            }}
          >
            <AddIcon className="h-3 w-3" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {body}
    </div>
  );
}

function AssetRow({
  label,
  hint,
  active,
  onClick,
  onDelete,
  deleteLabel,
}: {
  label: string;
  hint?: string | null;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <li>
      <div className="group flex items-stretch gap-0.5">
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent/40",
            active ? "bg-accent/50 font-medium text-foreground" : "text-muted-foreground",
          )}
          onClick={onClick}
        >
          <span className="truncate text-[11px]">{label}</span>
          {hint ? <span className="truncate text-[10px] text-muted-foreground/80">{hint}</span> : null}
        </button>
        {onDelete && deleteLabel ? (
          <TreeRowActions onDelete={onDelete} deleteLabel={deleteLabel} className="self-center pr-0.5" />
        ) : null}
      </div>
    </li>
  );
}

export function PaperAssetsPanel({
  paperPath,
  currentPath,
  activeFile,
  refreshVersion,
  onNavigate,
  onOpenFile,
  onModelChanged,
  onError,
}: {
  paperPath: string | null;
  currentPath: string;
  activeFile: string | null;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
}) {
  const [assets, setAssets] = useState<PaperAssetsBundle | null>(null);
  const [referenceResults, setReferenceResults] = useState<ReferenceMetadata[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const bibInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => {
    if (!paperPath) {
      setAssets(null);
      return;
    }
    setLoading(true);
    try {
      const nextAssets = await fetchPaperAssets(paperPath);
      setAssets(nextAssets);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setAssets(null);
    } finally {
      setLoading(false);
    }
  }, [onError, paperPath]);

  const handleModelChanged = useCallback(() => {
    onModelChanged();
    void loadAssets();
  }, [loadAssets, onModelChanged]);

  const { requestArchive, dialogs: archiveDialogs } = useArchiveNodeDialog({
    onChanged: handleModelChanged,
    onError,
    onArchived: (path) => navigateAfterArchive(path, currentPath, onNavigate, activeFile),
  });

  useEffect(() => {
    void loadAssets();
  }, [loadAssets, refreshVersion]);

  useEffect(() => {
    if (!paperPath) {
      setReferenceResults([]);
      return;
    }
    const query = searchQuery.trim();
    if (!query) {
      setReferenceResults([]);
      return;
    }
    let cancelled = false;
    setReferencesLoading(true);
    void ensureReferenceIndex(paperPath)
      .then((references) => {
        if (!cancelled) {
          setReferenceResults(searchReferences(references, query, 50));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : String(err));
          setReferenceResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setReferencesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError, paperPath, refreshVersion, searchQuery]);

  const openAsset = (item: FigureMetadata | TableMetadata | EquationMetadata | ReferenceMetadata) => {
    if ("citeKey" in item) {
      onOpenFile("main.bib");
      return;
    }
    if (item.kind.endsWith("-note") && item.outlinePath?.endsWith(".md")) {
      onOpenFile(item.outlinePath);
      return;
    }
    onNavigate(item.path);
  };

  const isActive = (item: FigureMetadata | TableMetadata | EquationMetadata | ReferenceMetadata): boolean => {
    if ("citeKey" in item) {
      return activeFile === item.path;
    }
    if (currentPath === item.path || currentPath.startsWith(`${item.path}/`)) return true;
    if (item.outlinePath && activeFile === item.outlinePath) return true;
    if ("draftPath" in item && item.draftPath && activeFile === item.draftPath) return true;
    return false;
  };

  const submitCreate = async (rawName: string) => {
    if (!createKind || !paperPath) return;
    const kind = createKind;
    setCreateKind(null);
    const name = slugifyAssetName(rawName);
    if (!name) {
      onError("Name is required");
      return;
    }

    try {
      if (kind === "figure") {
        const created = await createNode(`${paperPath}/figures`, name, "figure");
        handleModelChanged();
        onNavigate(created.path);
        return;
      }
      if (kind === "equation") {
        const created = await createNode(`${paperPath}/equations`, name, "equation");
        handleModelChanged();
        onNavigate(created.path);
        return;
      }
      const created = await createNode(`${paperPath}/tables`, name, "table");
      handleModelChanged();
      onNavigate(created.path);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleBibImport = async (file: File) => {
    if (!paperPath) return;
    if (file.size > 20 * 1024 * 1024) {
      onError("Bibliography file too large (max 20MB)");
      return;
    }
    setImporting(true);
    setImportNotice(null);
    try {
      const bibtex = await file.text();
      const result = await importReferencesFromBibtex(paperPath, bibtex);
      if (result.created.length > 0) {
        invalidateReferenceSearchCache(paperPath);
        handleModelChanged();
      }
      const parts: string[] = [];
      if (result.created.length > 0) parts.push(`${result.created.length} main.bib entries created`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
      if (parts.length > 0) {
        setImportNotice(parts.join(" · "));
      } else if (result.errors.length > 0) {
        onError(result.errors.join("; "));
      } else {
        onError("No references were imported — check that the file contains @article{…} entries");
      }
      if (result.errors.length > 0 && result.created.length > 0) {
        onError(result.errors.join("; "));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      if (bibInputRef.current) bibInputRef.current.value = "";
    }
  };

  if (!paperPath) {
    return (
      <p className="px-3 py-4 text-[11px] text-muted-foreground">Select a paper to view figures, tables, equations, and references.</p>
    );
  }

  if (loading && !assets) {
    return <p className="px-3 py-4 text-[11px] text-muted-foreground">Loading assets…</p>;
  }

  const allAssets: PaperAssetsBundle = assets ?? {
    figures: [],
    tables: [],
    equations: [],
    referenceCount: 0,
  };
  const referenceCount = allAssets.referenceCount;
  const assetsForCounts = { ...allAssets, referenceCount };
  const isSearching = searchQuery.trim().length > 0;
  const filteredAssets = filterPaperAssets(
    assetsForCounts,
    searchQuery,
    isSearching ? referenceResults : [],
  );
  const figures = filteredAssets.figures;
  const tables = filteredAssets.tables;
  const equations = filteredAssets.equations;
  const references = isSearching ? filteredAssets.references : [];
  const totalCount = totalAssetCount(assetsForCounts);
  const visibleCount = filteredAssetCount(filteredAssets);

  const groupCountLabel = (filtered: number, total: number) => {
    if (!isSearching || total === 0) return undefined;
    if (filtered === 0) return "No matches";
    if (filtered === total) return `${filtered} item${filtered === 1 ? "" : "s"}`;
    return `${filtered} of ${total}`;
  };

  const isAssetFolderActive = (folder: "figures" | "tables" | "equations") => {
    const folderPath = `${paperPath}/${folder}`;
    return currentPath === folderPath || currentPath.startsWith(`${folderPath}/`);
  };

  const literaturePath = `${paperPath}/notes/literature`;
  const isReferencesActive =
    activeFile === "main.bib" ||
    currentPath === literaturePath ||
    currentPath.startsWith(`${literaturePath}/`);

  return (
    <>
      <input
        ref={bibInputRef}
        type="file"
        accept=".bib,.txt,application/x-bibtex,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleBibImport(file);
        }}
      />

      <div className="min-h-0 overflow-auto py-1">
        <AssetSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-2 py-2"
        />
        {isSearching && totalCount > 0 && visibleCount === 0 ? (
          <p className="px-3 py-2 text-[11px] text-muted-foreground">
            No assets match “{searchQuery.trim()}”.
          </p>
        ) : null}

        {!isSearching || allAssets.figures.length > 0 ? (
        <AssetGroup
          title="Figures"
          icon={Image}
          emptyLabel={isSearching ? "No figures match your search" : "No figures yet"}
          count={figures.length}
          countLabel={groupCountLabel(figures.length, allAssets.figures.length)}
          active={isAssetFolderActive("figures")}
          onOpen={() => onNavigate(`${paperPath}/figures`)}
          onAdd={() => setCreateKind("figure")}
        >
          {figures.map((figure) => (
            <AssetRow
              key={figure.path}
              label={figure.figureLabel ?? figure.title}
              hint={figure.caption || figure.summary}
              active={isActive(figure)}
              onClick={() => openAsset(figure)}
              onDelete={() => requestArchive(figure.path, figure.title)}
              deleteLabel={`Remove figure ${figure.title}`}
            />
          ))}
        </AssetGroup>
        ) : null}

        {!isSearching || allAssets.tables.length > 0 ? (
        <AssetGroup
          title="Tables"
          icon={Table2}
          emptyLabel={isSearching ? "No tables match your search" : "No tables yet"}
          count={tables.length}
          countLabel={groupCountLabel(tables.length, allAssets.tables.length)}
          active={isAssetFolderActive("tables")}
          onOpen={() => onNavigate(`${paperPath}/tables`)}
          onAdd={() => setCreateKind("table")}
        >
          {tables.map((table) => (
            <AssetRow
              key={table.path}
              label={table.tableLabel ?? table.title}
              hint={table.caption || table.summary}
              active={isActive(table)}
              onClick={() => openAsset(table)}
              onDelete={() => requestArchive(table.path, table.title)}
              deleteLabel={`Remove table ${table.title}`}
            />
          ))}
        </AssetGroup>
        ) : null}

        {!isSearching || allAssets.equations.length > 0 ? (
        <AssetGroup
          title="Equations"
          icon={Sigma}
          emptyLabel={isSearching ? "No equations match your search" : "No equations yet"}
          count={equations.length}
          countLabel={groupCountLabel(equations.length, allAssets.equations.length)}
          active={isAssetFolderActive("equations")}
          onOpen={() => onNavigate(`${paperPath}/equations`)}
          onAdd={() => setCreateKind("equation")}
        >
          {equations.map((equation) => (
            <AssetRow
              key={equation.path}
              label={equation.equationLabel ?? equation.title}
              hint={equation.caption || equation.summary}
              active={isActive(equation)}
              onClick={() => openAsset(equation)}
              onDelete={() => requestArchive(equation.path, equation.title)}
              deleteLabel={`Remove equation ${equation.title}`}
            />
          ))}
        </AssetGroup>
        ) : null}

        {!isSearching || referenceCount > 0 ? (
        <AssetGroup
          title="References"
          icon={BookOpen}
          emptyLabel={
            isSearching
              ? referencesLoading
                ? "Searching references…"
                : "No references match your search"
              : importing
                ? "Importing…"
                : referenceCount > 0
                  ? "Open main.bib to manage references"
                  : "Import a .bib file — creates centralized main.bib entries"
          }
          count={!isSearching && referenceCount > 0 ? 1 : references.length}
          countLabel={
            isSearching
              ? groupCountLabel(references.length, referenceCount)
              : referenceCount > 0
                ? `${referenceCount} reference${referenceCount === 1 ? "" : "s"}`
                : undefined
          }
          active={isReferencesActive}
          collapsible
          defaultExpanded
          onOpen={() => onOpenFile("main.bib")}
          addIcon={Upload}
          addTitle="Import BibTeX (.bib)"
          onAdd={() => bibInputRef.current?.click()}
        >
          {!isSearching && referenceCount > 0 ? (
            <AssetRow
              label="main.bib"
              hint={`${referenceCount} centralized reference${referenceCount === 1 ? "" : "s"}`}
              active={activeFile === "main.bib"}
              onClick={() => onOpenFile("main.bib")}
            />
          ) : (
            references.map((ref) => (
              <AssetRow
                key={ref.path}
                label={`@${ref.citeKey}`}
                hint={ref.title}
                active={activeFile === "main.bib"}
                onClick={() => openAsset(ref)}
              />
            ))
          )}
        </AssetGroup>
        ) : null}

        {importNotice ? (
          <p className="px-3 pb-2 text-[10px] text-muted-foreground">{importNotice}</p>
        ) : null}
      </div>

      <NamePromptDialog
        open={createKind === "figure"}
        title="New figure"
        label="Figure folder name"
        defaultValue=""
        confirmLabel="Create"
        onConfirm={submitCreate}
        onCancel={() => setCreateKind(null)}
      />
      <NamePromptDialog
        open={createKind === "table"}
        title="New table"
        label="Table folder name"
        defaultValue=""
        confirmLabel="Create"
        onConfirm={submitCreate}
        onCancel={() => setCreateKind(null)}
      />
      <NamePromptDialog
        open={createKind === "equation"}
        title="New equation"
        label="Equation folder name"
        defaultValue=""
        confirmLabel="Create"
        onConfirm={submitCreate}
        onCancel={() => setCreateKind(null)}
      />
      {archiveDialogs}
    </>
  );
}
