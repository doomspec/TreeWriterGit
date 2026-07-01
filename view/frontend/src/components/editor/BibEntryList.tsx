import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Trash2, Unlink2 } from "lucide-react";

import { BibVerificationBadge } from "@/components/editor/BibVerificationBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const BIB_ENTRY_LIST_ROW_HEIGHT = 48;

export type BibListItem = {
  citeKey: string;
  title: string;
  subtitle?: string | null;
  verifiedStatus: "verified" | "stale" | "unverified";
  /** When false, row is visible but cannot be checked for bulk delete. */
  deletable?: boolean;
  /** Cited in drafts but absent from main.bib. */
  missingFromLibrary?: boolean;
};

const BibEntryListRow = memo(function BibEntryListRow({
  entry,
  selected,
  checked,
  showCheckbox,
  deleting,
  onSelect,
  onToggleChecked,
  onDelete,
  onRemoveFromText,
}: {
  entry: BibListItem;
  selected: boolean;
  checked: boolean;
  showCheckbox: boolean;
  deleting?: boolean;
  onSelect: (citeKey: string) => void;
  onToggleChecked?: (citeKey: string) => void;
  onDelete?: (citeKey: string) => void;
  onRemoveFromText?: (citeKey: string) => void;
}) {
  const deletable = entry.deletable !== false;
  const canDelete = deletable && Boolean(onDelete);
  const canRemoveFromText = entry.missingFromLibrary && Boolean(onRemoveFromText);
  const detail =
    entry.subtitle && entry.subtitle !== entry.title ? entry.subtitle : entry.title !== entry.citeKey ? entry.title : null;

  const handleClick = () => {
    if (showCheckbox && deletable) {
      onToggleChecked?.(entry.citeKey);
      return;
    }
    onSelect(entry.citeKey);
  };

  return (
    <div
      className={cn(
        "flex h-full min-w-0 items-stretch gap-0.5 overflow-hidden rounded-md border",
        selected && !showCheckbox ? "border-primary/40 bg-accent/50" : "border-transparent",
        showCheckbox && checked ? "border-primary/30 bg-accent/40" : "",
        showCheckbox && !deletable ? "opacity-60" : "",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1.5 py-1 text-left hover:bg-accent/40",
          selected && !showCheckbox ? "text-foreground" : "text-muted-foreground",
        )}
        onClick={handleClick}
      >
        {showCheckbox ? (
          <input
            type="checkbox"
            className="shrink-0"
            checked={checked}
            disabled={!deletable}
            aria-label={`Select @${entry.citeKey}`}
            onClick={(event) => event.stopPropagation()}
            onChange={() => {
              if (deletable) onToggleChecked?.(entry.citeKey);
            }}
          />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-[10px] leading-tight">@{entry.citeKey}</span>
            <BibVerificationBadge status={entry.verifiedStatus} />
          </span>
          {detail ? (
            <span className="truncate text-[10px] leading-tight text-muted-foreground/90">{detail}</span>
          ) : entry.subtitle ? (
            <span className="truncate text-[10px] leading-tight text-muted-foreground/90">{entry.subtitle}</span>
          ) : null}
        </span>
      </button>
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-auto w-7 shrink-0 rounded-none text-muted-foreground hover:text-destructive"
          title={`Remove @${entry.citeKey} from main.bib`}
          aria-label={`Remove @${entry.citeKey} from main.bib`}
          disabled={deleting}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(entry.citeKey);
          }}
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
      {canRemoveFromText ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-auto w-7 shrink-0 rounded-none text-muted-foreground hover:text-foreground"
          title={`Remove [@${entry.citeKey}] from drafts`}
          aria-label={`Remove [@${entry.citeKey}] from drafts`}
          disabled={deleting}
          onClick={(event) => {
            event.stopPropagation();
            onRemoveFromText?.(entry.citeKey);
          }}
        >
          <Unlink2 className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
});

export function BibEntryList({
  items,
  selectedKey,
  onSelect,
  emptyLabel = "No BibTeX entries.",
  className,
  selectionMode = false,
  checkedKeys,
  onToggleChecked,
  onDelete,
  onRemoveFromText,
  deletingKey = null,
}: {
  items: BibListItem[];
  selectedKey: string | null;
  onSelect: (citeKey: string) => void;
  emptyLabel?: string;
  className?: string;
  selectionMode?: boolean;
  checkedKeys?: ReadonlySet<string>;
  onToggleChecked?: (citeKey: string) => void;
  onDelete?: (citeKey: string) => void;
  onRemoveFromText?: (citeKey: string) => void;
  deletingKey?: string | null;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => BIB_ENTRY_LIST_ROW_HEIGHT,
    overscan: 4,
  });

  if (items.length === 0) {
    return <p className={cn("px-3 py-4 text-xs text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  return (
    <div ref={parentRef} className={cn("min-h-0 flex-1 overflow-auto p-2", className)}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const entry = items[virtualRow.index];
          if (!entry) return null;
          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 w-full overflow-hidden px-0.5"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <BibEntryListRow
                entry={entry}
                selected={selectedKey === entry.citeKey}
                checked={checkedKeys?.has(entry.citeKey) ?? false}
                showCheckbox={selectionMode}
                deleting={deletingKey === entry.citeKey}
                onSelect={onSelect}
                onToggleChecked={onToggleChecked}
                onDelete={onDelete}
                onRemoveFromText={onRemoveFromText}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
