import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Image, Plus, Table2, Upload } from "lucide-react";

import { TreeRowActions } from "@/components/nav/TreeRowActions";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import {
  fetchPaperAssets,
  importReferencesFromBibtex,
  slugifyAssetName,
  type PaperAssetsBundle,
  type ReferenceMetadata,
  type TableMetadata,
} from "@/lib/paperAssets";
import { navigateAfterArchive, useArchiveNodeDialog } from "@/lib/useArchiveNodeDialog";
import type { FigureMetadata } from "@/lib/figures";
import { cn } from "@/lib/utils";
import { createNode } from "@/modelApi";

type CreateKind = "figure" | "table";

function AssetGroup({
  title,
  icon: Icon,
  emptyLabel,
  count,
  onAdd,
  addIcon: AddIcon = Plus,
  addTitle,
  children,
}: {
  title: string;
  icon: typeof Image;
  emptyLabel: string;
  count: number;
  onAdd: () => void;
  addIcon?: typeof Plus;
  addTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{title}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title={addTitle ?? `New ${title.toLowerCase().replace(/s$/, "")}`}
          aria-label={addTitle ?? `New ${title.toLowerCase().replace(/s$/, "")}`}
          onClick={onAdd}
        >
          <AddIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      {count > 0 ? (
        <ul className="space-y-0.5 px-2 pb-2">{children}</ul>
      ) : (
        <p className="px-3 pb-2 text-[11px] text-muted-foreground">{emptyLabel}</p>
      )}
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
      setAssets(await fetchPaperAssets(paperPath));
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

  const openAsset = (item: FigureMetadata | TableMetadata | ReferenceMetadata) => {
    if ("citeKey" in item) {
      onOpenFile(item.path);
      return;
    }
    if (item.kind.endsWith("-note") && item.outlinePath?.endsWith(".md")) {
      onOpenFile(item.outlinePath);
      return;
    }
    onNavigate(item.path);
  };

  const isActive = (item: FigureMetadata | TableMetadata | ReferenceMetadata): boolean => {
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
      const created = await createNode(`${paperPath}/tables`, name, "table");
      handleModelChanged();
      onNavigate(created.path);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleBibImport = async (file: File) => {
    if (!paperPath) return;
    setImporting(true);
    setImportNotice(null);
    try {
      const bibtex = await file.text();
      const result = await importReferencesFromBibtex(paperPath, bibtex);
      if (result.created.length > 0) {
        onModelChanged();
      }
      const parts: string[] = [];
      if (result.created.length > 0) parts.push(`${result.created.length} imported`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
      if (parts.length > 0) {
        setImportNotice(parts.join(", "));
      } else if (result.errors.length > 0) {
        onError(result.errors.join("; "));
      } else {
        onError("No references were imported");
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
      <p className="px-3 py-4 text-[11px] text-muted-foreground">Select a paper to view figures, tables, and references.</p>
    );
  }

  if (loading && !assets) {
    return <p className="px-3 py-4 text-[11px] text-muted-foreground">Loading assets…</p>;
  }

  const figures = assets?.figures ?? [];
  const tables = assets?.tables ?? [];
  const references = assets?.references ?? [];

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
        <AssetGroup
          title="Figures"
          icon={Image}
          emptyLabel="No figures yet"
          count={figures.length}
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

        <AssetGroup
          title="Tables"
          icon={Table2}
          emptyLabel="No tables yet"
          count={tables.length}
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

        <AssetGroup
          title="References"
          icon={BookOpen}
          emptyLabel={importing ? "Importing…" : "Import a .bib file to add references"}
          count={references.length}
          addIcon={Upload}
          addTitle="Import BibTeX (.bib)"
          onAdd={() => bibInputRef.current?.click()}
        >
          {references.map((ref) => (
            <AssetRow
              key={ref.path}
              label={ref.citeKey ? `@${ref.citeKey}` : ref.title}
              hint={ref.authors ? `${ref.authors}${ref.year ? ` (${ref.year})` : ""}` : ref.title}
              active={isActive(ref)}
              onClick={() => openAsset(ref)}
              onDelete={() =>
                requestArchive(ref.path, ref.citeKey ? `@${ref.citeKey}` : ref.title)
              }
              deleteLabel={`Remove reference ${ref.citeKey ?? ref.title}`}
            />
          ))}
        </AssetGroup>

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
      {archiveDialogs}
    </>
  );
}
