import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Image, Layers, Sigma, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AssetSearchField } from "@/components/editor/AssetSearchField";
import {
  defaultEquationInsertMode,
  defaultFigureInsertMode,
  equationInsertSnippet,
  figureInsertSnippet,
  referenceInsertSnippet,
  tableInsertSnippet,
} from "@/lib/assetInsert";
import type { FigureMetadata } from "@/lib/figures";
import {
  type EquationMetadata,
  fetchPaperAssets,
  type PaperAssetsBundle,
  type ReferenceMetadata,
  type TableMetadata,
} from "@/lib/paperAssets";
import { filterPaperAssets, filteredAssetCount, totalAssetCount } from "@/lib/assetSearch";
import { ensureReferenceIndex, searchReferences } from "@/lib/referenceSearchCache";
import { cn } from "@/lib/utils";

type AssetInsertMenuProps = {
  paperPath: string;
  filePath: string;
  refreshVersion: number;
  disabled?: boolean;
  embedded?: boolean;
  /** Compact icon-only button for the floating inline toolbar. */
  inline?: boolean;
  onInsert: (snippet: string) => void;
};

function AssetSection({
  title,
  icon: Icon,
  emptyLabel,
  noMatchLabel,
  count,
  children,
}: {
  title: string;
  icon: typeof Image;
  emptyLabel: string;
  noMatchLabel?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="asset-insert-menu__section">
      <div className="asset-insert-menu__section-title">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {title}
        {count > 0 ? <span className="ml-auto font-normal normal-case tracking-normal">({count})</span> : null}
      </div>
      {count > 0 ? (
        <ul className="asset-insert-menu__list">{children}</ul>
      ) : (
        <p className="asset-insert-menu__empty">{noMatchLabel ?? emptyLabel}</p>
      )}
    </div>
  );
}

function AssetPickButton({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string | null;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className="asset-insert-menu__item" onClick={onClick}>
        <span className="truncate">{label}</span>
        {hint ? <span className="truncate text-muted-foreground">{hint}</span> : null}
      </button>
    </li>
  );
}

export function AssetInsertMenu({
  paperPath,
  filePath,
  refreshVersion,
  disabled = false,
  embedded = false,
  inline = false,
  onInsert,
}: AssetInsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [assets, setAssets] = useState<PaperAssetsBundle | null>(null);
  const [referenceResults, setReferenceResults] = useState<ReferenceMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);

  const figureMode = defaultFigureInsertMode(filePath);
  const equationMode = defaultEquationInsertMode(filePath);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      setAssets(await fetchPaperAssets(paperPath));
    } catch {
      setAssets(null);
    } finally {
      setLoading(false);
    }
  }, [paperPath]);

  useEffect(() => {
    if (!open) return;
    void loadAssets();
  }, [loadAssets, open, refreshVersion]);

  useEffect(() => {
    if (!open) {
      setReferenceResults([]);
      return;
    }
    const query = searchQuery.trim();
    if (!query) {
      setReferenceResults([]);
      return;
    }
    let cancelled = false;
    void ensureReferenceIndex(paperPath)
      .then((references) => {
        if (!cancelled) setReferenceResults(searchReferences(references, query, 30));
      })
      .catch(() => {
        if (!cancelled) setReferenceResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, paperPath, refreshVersion, searchQuery]);

  useEffect(() => {
    if (open) return;
    setSearchQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const panelWidth = Math.min(288, window.innerWidth - 16);
      let left = rect.left;
      if (left + panelWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - panelWidth - 8);
      }
      setPanelPosition({ top: rect.bottom + 4, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const pick = (snippet: string) => {
    onInsert(snippet);
    setOpen(false);
  };

  const allAssets: PaperAssetsBundle = assets ?? {
    figures: [],
    tables: [],
    equations: [],
    referenceCount: 0,
  };
  const filteredAssets = filterPaperAssets(allAssets, searchQuery, referenceResults);
  const figures = filteredAssets.figures;
  const tables = filteredAssets.tables;
  const equations = filteredAssets.equations;
  const references = filteredAssets.references;
  const totalCount = totalAssetCount(allAssets);
  const visibleCount = filteredAssetCount(filteredAssets);
  const isSearching = searchQuery.trim().length > 0;

  const panel =
    open && panelPosition ? (
      <div
        ref={panelRef}
        role="listbox"
        aria-label="Paper assets"
        data-editor-floating-chrome
        style={{ top: panelPosition.top, left: panelPosition.left }}
        className="asset-insert-menu__panel asset-insert-menu__panel--portal"
      >
        {loading && !assets ? (
          <p className="asset-insert-menu__empty px-3 py-2">Loading assets…</p>
        ) : (
          <>
            <AssetSearchField
              value={searchQuery}
              onChange={setSearchQuery}
              autoFocus
              className="border-b border-border/60"
            />
            {isSearching && totalCount > 0 && visibleCount === 0 ? (
              <p className="asset-insert-menu__empty px-3 py-2">No assets match “{searchQuery.trim()}”.</p>
            ) : null}
            {!isSearching || allAssets.figures.length > 0 ? (
            <AssetSection
              title="Figures"
              icon={Image}
              emptyLabel="No figures yet — add one in the sidebar"
              noMatchLabel={isSearching ? "No figures match your search" : undefined}
              count={figures.length}
            >
              {figures.map((fig: FigureMetadata) => (
                <AssetPickButton
                  key={fig.path}
                  label={fig.title}
                  hint={figureMode === "embed" ? "Embed figure" : "Link to figure"}
                  onClick={() => pick(figureInsertSnippet(fig.path, fig.title, figureMode))}
                />
              ))}
            </AssetSection>
            ) : null}
            {!isSearching || allAssets.tables.length > 0 ? (
            <AssetSection
              title="Tables"
              icon={Table2}
              emptyLabel="No tables yet — add one in the sidebar"
              noMatchLabel={isSearching ? "No tables match your search" : undefined}
              count={tables.length}
            >
              {tables.map((table: TableMetadata) => (
                <AssetPickButton
                  key={table.path}
                  label={table.title}
                  hint="Link to table"
                  onClick={() => pick(tableInsertSnippet(table.path, table.title))}
                />
              ))}
            </AssetSection>
            ) : null}
            {!isSearching || allAssets.equations.length > 0 ? (
            <AssetSection
              title="Equations"
              icon={Sigma}
              emptyLabel="No equations yet — add one in the sidebar"
              noMatchLabel={isSearching ? "No equations match your search" : undefined}
              count={equations.length}
            >
              {equations.map((equation: EquationMetadata) => (
                <AssetPickButton
                  key={equation.path}
                  label={equation.title}
                  hint={equationMode === "embed" ? "Embed equation" : "Link to equation"}
                  onClick={() => pick(equationInsertSnippet(equation.path, equation.title, equationMode))}
                />
              ))}
            </AssetSection>
            ) : null}
            {!isSearching || allAssets.referenceCount > 0 ? (
            <AssetSection
              title="References"
              icon={BookOpen}
              emptyLabel={
                isSearching
                  ? "No references match your search"
                  : allAssets.referenceCount > 0
                    ? "Type in the search box to find references"
                    : "Import a .bib file in the sidebar"
              }
              noMatchLabel={isSearching ? "No references match your search" : undefined}
              count={isSearching ? references.length : allAssets.referenceCount}
            >
              {isSearching
                ? references.map((ref: ReferenceMetadata) => (
                <AssetPickButton
                  key={ref.path}
                  label={ref.citeKey ? `@${ref.citeKey}` : ref.title}
                  hint={ref.authors ?? ref.title}
                  onClick={() => {
                    if (!ref.citeKey) return;
                    pick(referenceInsertSnippet(ref.citeKey));
                  }}
                />
              ))
                : null}
            </AssetSection>
            ) : null}
          </>
        )}
      </div>
    ) : null;

  const toggleOpen = () => setOpen((value) => !value);

  return (
    <div ref={rootRef} className={cn("asset-insert-menu", embedded && "asset-insert-menu--embedded")}>
      <Button
        ref={buttonRef}
        type="button"
        variant={open ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 shrink-0 gap-1 text-[10px]",
          inline || embedded ? "w-7 px-0" : "px-2",
        )}
        title="Insert figure, table, equation, or reference — or type \\fig{}, \\table{}, \\cite{}, \\eq{}"
        aria-label="Insert asset"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onMouseDown={
          inline
            ? (event) => {
                event.preventDefault();
                if (!disabled) toggleOpen();
              }
            : undefined
        }
        onClick={inline ? undefined : () => !disabled && toggleOpen()}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        <span className={inline || embedded ? "sr-only" : "hidden sm:inline"}>Assets</span>
      </Button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
