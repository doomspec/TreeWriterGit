import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { cn } from "@/lib/utils";
import {
  fetchTrashedItems,
  purgeTrashedItem,
  restoreTrashedItem,
  type TrashedItem,
} from "@/modelApi";

function formatRemovedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TrashPanel({
  paperPath,
  refreshVersion,
  onModelChanged,
  onNavigate,
  onError,
}: {
  paperPath: string | null;
  refreshVersion: number;
  onModelChanged: () => void;
  onNavigate: (path: string) => void;
  onError: (message: string) => void;
}) {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<TrashedItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!paperPath) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchTrashedItems(paperPath);
      setItems(data.items);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [onError, paperPath]);

  useEffect(() => {
    void loadItems();
  }, [loadItems, refreshVersion]);

  const handleRestore = async (item: TrashedItem) => {
    if (!paperPath) return;
    setBusyId(item.id);
    try {
      const restored = await restoreTrashedItem(paperPath, item.id);
      onModelChanged();
      await loadItems();
      onNavigate(restored.item.originalPath);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handlePurgeConfirm = async () => {
    if (!paperPath || !purgeTarget) return;
    const target = purgeTarget;
    setPurgeTarget(null);
    setBusyId(target.id);
    try {
      await purgeTrashedItem(paperPath, target.id);
      onModelChanged();
      await loadItems();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (!paperPath) {
    return (
      <p className="px-3 py-4 text-[11px] text-muted-foreground">
        Select a paper to view removed items.
      </p>
    );
  }

  if (loading && items.length === 0) {
    return <p className="px-3 py-4 text-[11px] text-muted-foreground">Loading removed items…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="px-3 py-4 text-[11px] text-muted-foreground">
        Nothing in Removed. Deleting a section, unit, figure, table, or reference moves it here first.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-0.5 px-2 pb-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="group rounded-md border border-border/60 bg-background px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-foreground">{item.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{item.originalPath}</p>
              <p className="text-[9px] text-muted-foreground/80">{formatRemovedDate(item.deletedAt)}</p>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[9px]"
                disabled={busyId === item.id}
                onClick={() => void handleRestore(item)}
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Restore
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 gap-1 px-1.5 text-[9px] text-destructive hover:text-destructive",
                )}
                disabled={busyId === item.id}
                onClick={() => setPurgeTarget(item)}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Delete forever
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={purgeTarget !== null}
        title="Delete permanently?"
        message={
          purgeTarget
            ? `${purgeTarget.label} will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete forever"
        destructive
        onConfirm={() => void handlePurgeConfirm()}
        onCancel={() => setPurgeTarget(null)}
      />
    </>
  );
}
