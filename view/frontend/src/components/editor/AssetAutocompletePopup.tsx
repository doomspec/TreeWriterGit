import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Check, HelpCircle, Image, Sigma, Table2 } from "lucide-react";

import type { AssetCompletionItem, AssetCommandKind } from "@/lib/assetAutocomplete";
import { ASSET_COMMAND_HELP, CITE_SEARCH_HELP } from "@/lib/assetAutocomplete";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<AssetCommandKind, typeof Image> = {
  fig: Image,
  table: Table2,
  eq: Sigma,
  cite: BookOpen,
  ref: Image,
};

export function AssetAutocompletePopup({
  open,
  top,
  left,
  items,
  selectedIndex,
  selectedCiteKeys = [],
  attachedCiteKeys = [],
  isCiteMode = false,
  loading,
  commandLabel,
  onPick,
  onHighlightIndex,
  onToggleCiteKey,
  onPopupInteractionStart,
  onPopupInteractionEnd,
  onClose,
}: {
  open: boolean;
  top: number | null;
  left: number | null;
  items: AssetCompletionItem[];
  selectedIndex: number;
  selectedCiteKeys?: string[];
  attachedCiteKeys?: string[];
  isCiteMode?: boolean;
  loading?: boolean;
  commandLabel?: string | null;
  onPick: (item: AssetCompletionItem) => void;
  onHighlightIndex?: (index: number) => void;
  onToggleCiteKey?: (citeKey: string) => void;
  onPopupInteractionStart?: () => void;
  onPopupInteractionEnd?: () => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const endInteraction = () => onPopupInteractionEnd?.();
    window.addEventListener("mouseup", endInteraction);
    return () => window.removeEventListener("mouseup", endInteraction);
  }, [open, onPopupInteractionEnd]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex, items.length]);

  if (!open || top === null || left === null) return null;

  const panelWidth = Math.min(320, window.innerWidth - 16);
  let panelLeft = left;
  if (panelLeft + panelWidth > window.innerWidth - 8) {
    panelLeft = Math.max(8, window.innerWidth - panelWidth - 8);
  }
  const panelTop = Math.min(top, window.innerHeight - 240);

  const panel = (
    <div
      role="listbox"
      aria-label={commandLabel ? `${commandLabel} autocomplete` : "Asset autocomplete"}
      style={{ top: panelTop, left: panelLeft, width: panelWidth }}
      className="asset-autocomplete fixed z-overlay overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-lg"
      onMouseDown={(event) => {
        event.preventDefault();
        onPopupInteractionStart?.();
      }}
    >
      <div className="border-b border-border/60 px-2.5 py-1.5">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {commandLabel ?? "Assets"}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/90">
              {isCiteMode
                ? "↑↓ navigate · Enter/click add · ⌘/ctrl+Enter finish"
                : `${ASSET_COMMAND_HELP.map((entry) => entry.commands[0]).join("  ")}  ·  ↑↓ enter tab esc`}
            </p>
          </div>
          {isCiteMode ? (
            <div className="group relative shrink-0">
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Citation search help"
                title="Citation search help"
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <div
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-56 rounded-md border border-border bg-popover p-2 text-left shadow-lg group-hover:block group-focus-within:block"
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  Citation search
                </p>
                <ul className="m-0 list-none space-y-1 p-0 text-[10px] leading-snug text-muted-foreground">
                  {CITE_SEARCH_HELP.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
        {isCiteMode && attachedCiteKeys.length > 0 ? (
          <p className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[10px] text-foreground/90">
            <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
              <Check className="h-3 w-3" aria-hidden="true" />
              Attached
            </span>
            <span>{attachedCiteKeys.map((key) => `@${key}`).join("; ")}</span>
          </p>
        ) : null}
        {isCiteMode && selectedCiteKeys.length > 0 ? (
          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
            Multi-select: {selectedCiteKeys.map((key) => `@${key}`).join("; ")}
          </p>
        ) : null}
      </div>
      <div ref={listRef} className="max-h-56 overflow-auto py-1">
        {loading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Loading assets…</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No matching assets.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((item, index) => {
              const Icon = KIND_ICONS[item.kind];
              const isAttached = item.citeKey ? attachedCiteKeys.includes(item.citeKey) : false;
              const isMultiSelected = item.citeKey ? selectedCiteKeys.includes(item.citeKey) : false;
              const isHighlighted = index === selectedIndex;
              const showTick = isAttached || isMultiSelected;
              return (
                <li key={`${item.kind}-${item.label}-${index}`}>
                  <button
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted || isAttached || isMultiSelected}
                    className={cn(
                      "asset-autocomplete__item flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs",
                      isHighlighted && "asset-autocomplete__item--active",
                      showTick && "asset-autocomplete__item--attached",
                    )}
                    onMouseEnter={() => onHighlightIndex?.(index)}
                    onMouseDown={(event) => {
                      onHighlightIndex?.(index);
                      if (isCiteMode && event.shiftKey && item.citeKey && onToggleCiteKey) {
                        onToggleCiteKey(item.citeKey);
                        return;
                      }
                      onPick(item);
                    }}
                  >
                    {isCiteMode ? (
                      <span
                        className={cn(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px]",
                          showTick
                            ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                            : "border-border text-transparent",
                        )}
                        aria-hidden="true"
                      >
                        {showTick && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                      </span>
                    ) : (
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {isAttached ? (
                      <span className="shrink-0 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        Attached
                      </span>
                    ) : item.hint ? (
                      <span className="max-w-[45%] truncate text-[10px] text-muted-foreground">
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-border/60 px-2.5 py-1">
        <button
          type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => {
            event.preventDefault();
            onClose();
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
