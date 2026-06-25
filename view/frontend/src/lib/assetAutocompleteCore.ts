import { useMemo } from "react";

import type { AssetCompletionItem } from "@/lib/assetAutocomplete";

export type AssetAutocompleteTriggerState = {
  open: boolean;
  query: string;
  triggerStart: number;
  triggerEnd: number;
};

export function detectAssetAutocompleteTrigger(
  value: string,
  cursor: number,
): AssetAutocompleteTriggerState | null {
  const before = value.slice(0, cursor);
  const atMatch = before.match(/(?:^|\s)@([\w./-]*)$/);
  if (atMatch) {
    const query = atMatch[1] ?? "";
    const triggerStart = cursor - query.length - 1;
    return { open: true, query, triggerStart, triggerEnd: cursor };
  }
  const citeMatch = before.match(/(?:^|\s)\[@([\w,-]*)$/);
  if (citeMatch) {
    const query = citeMatch[1] ?? "";
    const triggerStart = cursor - query.length - 2;
    return { open: true, query, triggerStart, triggerEnd: cursor };
  }
  return null;
}

export function filterAutocompleteItems(
  items: AssetCompletionItem[],
  query: string,
  limit = 12,
): AssetCompletionItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items.slice(0, limit);
  return items
    .filter((item) => {
      const haystack = `${item.label} ${item.hint ?? ""} ${item.snippet}`.toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, limit);
}

export function useAssetAutocompleteQuery(items: AssetCompletionItem[], query: string) {
  return useMemo(() => filterAutocompleteItems(items, query), [items, query]);
}
