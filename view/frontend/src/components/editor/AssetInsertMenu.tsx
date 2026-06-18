import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Image, Layers, Sigma, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type AssetInsertMenuProps = {
  paperPath: string;
  filePath: string;
  refreshVersion: number;
  disabled?: boolean;
  embedded?: boolean;
  onInsert: (snippet: string) => void;
};

function AssetSection({
  title,
  icon: Icon,
  emptyLabel,
  count,
  children,
}: {
  title: string;
  icon: typeof Image;
  emptyLabel: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="asset-insert-menu__section">
      <div className="asset-insert-menu__section-title">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {title}
      </div>
      {count > 0 ? (
        <ul className="asset-insert-menu__list">{children}</ul>
      ) : (
        <p className="asset-insert-menu__empty">{emptyLabel}</p>
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
  onInsert,
}: AssetInsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<PaperAssetsBundle | null>(null);
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

  const figures = assets?.figures ?? [];
  const tables = assets?.tables ?? [];
  const equations = assets?.equations ?? [];
  const references = assets?.references ?? [];

  const panel =
    open && panelPosition ? (
      <div
        ref={panelRef}
        role="listbox"
        aria-label="Paper assets"
        style={{ top: panelPosition.top, left: panelPosition.left }}
        className="asset-insert-menu__panel asset-insert-menu__panel--portal"
      >
        {loading && !assets ? (
          <p className="asset-insert-menu__empty px-3 py-2">Loading assets…</p>
        ) : (
          <>
            <AssetSection
              title="Figures"
              icon={Image}
              emptyLabel="No figures yet — add one in the sidebar"
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
            <AssetSection
              title="Tables"
              icon={Table2}
              emptyLabel="No tables yet — add one in the sidebar"
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
            <AssetSection
              title="Equations"
              icon={Sigma}
              emptyLabel="No equations yet — add one in the sidebar"
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
            <AssetSection
              title="References"
              icon={BookOpen}
              emptyLabel="Import a .bib file in the sidebar"
              count={references.length}
            >
              {references.map((ref: ReferenceMetadata) => (
                <AssetPickButton
                  key={ref.path}
                  label={ref.citeKey ? `@${ref.citeKey}` : ref.title}
                  hint={ref.authors ?? ref.title}
                  onClick={() => {
                    if (!ref.citeKey) return;
                    pick(referenceInsertSnippet(ref.citeKey));
                  }}
                />
              ))}
            </AssetSection>
          </>
        )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn("asset-insert-menu", embedded && "asset-insert-menu--embedded")}>
      <Button
        ref={buttonRef}
        type="button"
        variant={open ? "default" : "ghost"}
        size="sm"
        className="h-7 shrink-0 gap-1 px-2 text-[10px]"
        title="Insert figure, table, equation, or reference from paper assets"
        aria-label="Insert asset"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Assets</span>
      </Button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
