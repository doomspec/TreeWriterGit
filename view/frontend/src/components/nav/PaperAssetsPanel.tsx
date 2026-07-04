import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Image,
  Plus,
  Settings2,
  Sigma,
  Table2,
} from "lucide-react";

import {
  AssetManagerModal,
  type AssetManagerMode,
  type AssetTab,
} from "@/components/editor/AssetManagerModal";
import { AssetSearchField } from "@/components/editor/AssetSearchField";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import { createNode, type NodeKind } from "@/modelApi";
import {
  fetchPaperAssets,
  type EquationMetadata,
  type PaperAssetsBundle,
  type TableMetadata,
} from "@/lib/paperAssets";
import { filterPaperAssets } from "@/lib/assetSearch";
import type { FigureMetadata } from "@/lib/figures";
import { cn } from "@/lib/utils";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";

type AssetFolder = "figures" | "tables" | "equations";

const ASSET_CREATE: Record<
  AssetFolder,
  { kind: NodeKind; label: string; createTitle: string; createPrompt: string }
> = {
  figures: {
    kind: "figure",
    label: "figure",
    createTitle: "New figure",
    createPrompt: "Figure folder name",
  },
  tables: {
    kind: "table",
    label: "table",
    createTitle: "New table",
    createPrompt: "Table folder name",
  },
  equations: {
    kind: "equation",
    label: "equation",
    createTitle: "New equation",
    createPrompt: "Equation folder name",
  },
};

function AssetGroupActions({
  createTitle,
  manageTitle,
  onCreate,
  onManage,
}: {
  createTitle: string;
  manageTitle: string;
  onCreate: () => void;
  onManage: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center pr-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title={createTitle}
        aria-label={createTitle}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onCreate();
        }}
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title={manageTitle}
        aria-label={manageTitle}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onManage();
        }}
      >
        <Settings2 className="h-3 w-3" aria-hidden="true" />
      </Button>
    </div>
  );
}

function AssetGroup({
  title,
  icon: Icon,
  emptyLabel,
  createLabel,
  showCreateEmpty,
  count,
  countLabel,
  active,
  onOpen,
  onCreate,
  onManage,
  manageTitle = "Manage…",
  collapsible = false,
  defaultExpanded = true,
  children,
}: {
  title: string;
  icon: typeof Image;
  emptyLabel: string;
  createLabel: string;
  showCreateEmpty: boolean;
  count: number;
  countLabel?: string;
  active?: boolean;
  onOpen: () => void;
  onCreate: () => void;
  onManage: () => void;
  manageTitle?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const body =
    count > 0 ? (
      <ul className="mt-1 space-y-0.5 px-2 pb-2">{children}</ul>
    ) : showCreateEmpty ? (
      <div className="px-2 pb-2 pt-1">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          onClick={onCreate}
        >
          <Plus className="h-3 w-3 shrink-0" aria-hidden="true" />
          {createLabel}
        </button>
      </div>
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
            <AssetGroupActions
              createTitle={createLabel}
              manageTitle={manageTitle ?? "Manage…"}
              onCreate={onCreate}
              onManage={onManage}
            />
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
        <AssetGroupActions
          createTitle={createLabel}
          manageTitle={manageTitle ?? "Manage…"}
          onCreate={onCreate}
          onManage={onManage}
        />
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
}: {
  label: string;
  hint?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex min-w-0 w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent/40",
          active ? "bg-accent/50 font-medium text-foreground" : "text-muted-foreground",
        )}
        onClick={onClick}
      >
        <span className="truncate text-[11px]">{label}</span>
        {hint ? <span className="truncate text-[10px] text-muted-foreground/80">{hint}</span> : null}
      </button>
    </li>
  );
}

export function AssetsPanel({
  paperPath,
  currentPath,
  activeFile,
  refreshVersion,
  onNavigate,
  onOpenFile,
  onModelChanged,
  onError,
  className,
}: {
  paperPath: string | null;
  currentPath: string;
  activeFile: string | null;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string, options?: { citeKey?: string }) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
  className?: string;
}) {
  const nav = useWorkspaceNavigationContext();
  const [assets, setAssets] = useState<PaperAssetsBundle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerTab, setManagerTab] = useState<AssetTab>("figures");
  const [managerMode, setManagerMode] = useState<AssetManagerMode>("manage");
  const [createFolder, setCreateFolder] = useState<AssetFolder | null>(null);
  const [creatingAsset, setCreatingAsset] = useState(false);

  const openManager = (tab: AssetTab, mode: AssetManagerMode = "manage") => {
    setManagerTab(tab);
    setManagerMode(mode);
    setManagerOpen(true);
  };

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

  useEffect(() => {
    void loadAssets();
  }, [loadAssets, refreshVersion]);

  const openAsset = (item: FigureMetadata | TableMetadata | EquationMetadata) => {
    if ("kind" in item && item.kind.endsWith("-note") && item.outlinePath?.endsWith(".md")) {
      onOpenFile(item.outlinePath);
      return;
    }
    onNavigate(item.path);
  };

  const isActive = (item: FigureMetadata | TableMetadata | EquationMetadata): boolean => {
    if (currentPath === item.path || currentPath.startsWith(`${item.path}/`)) return true;
    if (item.outlinePath && activeFile === item.outlinePath) return true;
    if ("draftPath" in item && item.draftPath && activeFile === item.draftPath) return true;
    return false;
  };

  if (!paperPath) {
    return (
      <p className="px-3 py-4 text-[11px] text-muted-foreground">Select a paper to view figures, tables, and equations.</p>
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
  const isSearching = searchQuery.trim().length > 0;
  const filteredAssets = filterPaperAssets(allAssets, searchQuery);
  const figures = filteredAssets.figures;
  const tables = filteredAssets.tables;
  const equations = filteredAssets.equations;
  const totalCount =
    allAssets.figures.length + allAssets.tables.length + allAssets.equations.length;
  const visibleCount = figures.length + tables.length + equations.length;

  const groupCountLabel = (filtered: number, total: number) => {
    if (!isSearching || total === 0) return undefined;
    if (filtered === 0) return "No matches";
    if (filtered === total) return `${filtered} item${filtered === 1 ? "" : "s"}`;
    return `${filtered} of ${total}`;
  };

  const isAssetFolderActive = (folder: AssetFolder) => {
    const folderPath = `${paperPath}/${folder}`;
    return currentPath === folderPath || currentPath.startsWith(`${folderPath}/`);
  };

  const handleCreateConfirm = async (name: string) => {
    if (!paperPath || !createFolder) return;
    const cfg = ASSET_CREATE[createFolder];
    setCreatingAsset(true);
    try {
      const result = await createNode(`${paperPath}/${createFolder}`, name, cfg.kind);
      setCreateFolder(null);
      handleModelChanged();
      onNavigate(result.path);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingAsset(false);
    }
  };

  return (
    <>
      <div className={cn("min-h-0 overflow-auto py-1", className)}>
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
          createLabel="Create figure"
          showCreateEmpty={!isSearching}
          count={figures.length}
          countLabel={groupCountLabel(figures.length, allAssets.figures.length)}
          active={isAssetFolderActive("figures")}
          onOpen={() => onNavigate(`${paperPath}/figures`)}
          onCreate={() => setCreateFolder("figures")}
          onManage={() => openManager("figures")}
          manageTitle="Manage figures"
        >
          {figures.map((figure) => (
            <AssetRow
              key={figure.path}
              label={figure.figureLabel ?? figure.title}
              hint={figure.caption || figure.summary}
              active={isActive(figure)}
              onClick={() => openAsset(figure)}
            />
          ))}
        </AssetGroup>
        ) : null}

        {!isSearching || allAssets.tables.length > 0 ? (
        <AssetGroup
          title="Tables"
          icon={Table2}
          emptyLabel={isSearching ? "No tables match your search" : "No tables yet"}
          createLabel="Create table"
          showCreateEmpty={!isSearching}
          count={tables.length}
          countLabel={groupCountLabel(tables.length, allAssets.tables.length)}
          active={isAssetFolderActive("tables")}
          onOpen={() => onNavigate(`${paperPath}/tables`)}
          onCreate={() => setCreateFolder("tables")}
          onManage={() => openManager("tables")}
          manageTitle="Manage tables"
        >
          {tables.map((table) => (
            <AssetRow
              key={table.path}
              label={table.tableLabel ?? table.title}
              hint={table.caption || table.summary}
              active={isActive(table)}
              onClick={() => openAsset(table)}
            />
          ))}
        </AssetGroup>
        ) : null}

        {!isSearching || allAssets.equations.length > 0 ? (
        <AssetGroup
          title="Equations"
          icon={Sigma}
          emptyLabel={isSearching ? "No equations match your search" : "No equations yet"}
          createLabel="Create equation"
          showCreateEmpty={!isSearching}
          count={equations.length}
          countLabel={groupCountLabel(equations.length, allAssets.equations.length)}
          active={isAssetFolderActive("equations")}
          onOpen={() => onNavigate(`${paperPath}/equations`)}
          onCreate={() => setCreateFolder("equations")}
          onManage={() => openManager("equations")}
          manageTitle="Manage equations"
        >
          {equations.map((equation) => (
            <AssetRow
              key={equation.path}
              label={equation.equationLabel ?? equation.title}
              hint={equation.caption || equation.summary}
              active={isActive(equation)}
              onClick={() => openAsset(equation)}
            />
          ))}
        </AssetGroup>
        ) : null}
      </div>

      <NamePromptDialog
        open={createFolder !== null}
        title={createFolder ? ASSET_CREATE[createFolder].createTitle : "New asset"}
        label={createFolder ? ASSET_CREATE[createFolder].createPrompt : "Name"}
        confirmLabel={creatingAsset ? "Creating…" : "Create"}
        onConfirm={(name) => {
          if (!creatingAsset) void handleCreateConfirm(name);
        }}
        onCancel={() => {
          if (!creatingAsset) setCreateFolder(null);
        }}
      />

      <AssetManagerModal
        open={managerOpen}
        mode={managerMode}
        paperPath={paperPath}
        initialTab={managerTab}
        filePath={activeFile ?? undefined}
        refreshVersion={refreshVersion}
        onClose={() => setManagerOpen(false)}
        onError={onError}
        onModelChanged={handleModelChanged}
        onInsert={
          managerMode === "insert" && nav.insertEditorSnippet
            ? (snippet) => {
                nav.insertEditorSnippet?.(snippet);
                setManagerOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}
