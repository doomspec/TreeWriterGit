import {
  appendCiteTriggerKey,
  appendOpenCitationKey,
  applyReferenceInsertion,
  defaultEquationInsertMode,
  defaultFigureInsertMode,
  equationInsertSnippet,
  figureInsertSnippet,
  finalizeCiteTrigger,
  parseCiteTriggerKeys,
  parseOpenCitationKeys,
  referenceInsertSnippet,
  tableInsertSnippet,
} from "@/lib/assetInsert";
import { pathSlug, scoreAssetMatch } from "@/lib/assetSearch";
import { crossRefInsertSnippet, figureRefKeyFromMeta, tableRefKeyFromMeta } from "@/lib/embedBlocks";
import type { FigureMetadata } from "@/lib/figures";
import type {
  EquationMetadata,
  PaperAssetsBundle,
  ReferenceMetadata,
  TableMetadata,
} from "@/lib/paperAssets";

export type AssetCommandKind = "fig" | "table" | "eq" | "cite" | "ref";

export type AssetCompletionItem = {
  kind: AssetCommandKind;
  label: string;
  hint?: string | null;
  snippet: string;
  citeKey?: string;
  refKey?: string;
};

export type AssetTrigger = {
  start: number;
  end: number;
  kind: AssetCommandKind;
  query: string;
  rawCommand: string;
  citeMode?: "command" | "open";
};

export const ASSET_COMMAND_HELP: { kind: AssetCommandKind; commands: string[]; label: string }[] = [
  { kind: "fig", commands: ["\\fig", "\\figure"], label: "Insert figure" },
  { kind: "table", commands: ["\\table", "\\tab"], label: "Insert table" },
  { kind: "eq", commands: ["\\eq", "\\equation"], label: "Insert equation" },
  { kind: "cite", commands: ["\\cite"], label: "Insert citation" },
  { kind: "ref", commands: ["\\ref"], label: "Insert cross-reference" },
];

const TRIGGER_PATTERN =
  /\\(fig(?:ure)?|tab(?:le)?|eq(?:uation)?|cite|ref)(\{([^}]*)?)?$/;

const OPEN_CITE_PATTERN = /\[@([^\]]*)$/;

function commandToKind(raw: string): AssetCommandKind {
  switch (raw) {
    case "fig":
    case "figure":
      return "fig";
    case "tab":
    case "table":
      return "table";
    case "eq":
    case "equation":
      return "eq";
    case "ref":
      return "ref";
    default:
      return "cite";
  }
}

/** Detect an active Overleaf-style asset command immediately before the cursor. */
export function detectAssetTrigger(text: string, cursor: number): AssetTrigger | null {
  if (cursor < 2) return null;
  const before = text.slice(0, cursor);

  const openCite = before.match(OPEN_CITE_PATTERN);
  if (openCite?.index !== undefined) {
    return {
      start: openCite.index,
      end: cursor,
      kind: "cite",
      query: openCite[1] ?? "",
      rawCommand: "open",
      citeMode: "open",
    };
  }

  const match = before.match(TRIGGER_PATTERN);
  if (!match || match.index === undefined) return null;
  const rawCommand = match[1] ?? "";
  return {
    start: match.index,
    end: cursor,
    kind: commandToKind(rawCommand),
    query: match[3] ?? "",
    rawCommand,
    citeMode: commandToKind(rawCommand) === "cite" ? "command" : undefined,
  };
}

function crossRefItem(
  kind: "fig" | "table",
  label: string,
  hint: string,
  refKey: string,
): AssetCompletionItem {
  return {
    kind: "ref",
    label,
    hint,
    snippet: crossRefInsertSnippet(refKey),
    refKey,
  };
}

function figureCrossRefItem(fig: FigureMetadata): AssetCompletionItem {
  const refKey = figureRefKeyFromMeta(fig);
  return crossRefItem("fig", fig.title, refKey, refKey);
}

function figureItem(fig: FigureMetadata, filePath: string): AssetCompletionItem {
  const mode = defaultFigureInsertMode(filePath);
  return {
    kind: "fig",
    label: fig.title,
    hint: fig.figureLabel ?? pathSlug(fig.path),
    snippet: figureInsertSnippet(fig.path, fig.title, mode),
  };
}

function tableCrossRefItem(table: TableMetadata): AssetCompletionItem {
  const refKey = tableRefKeyFromMeta(table);
  return crossRefItem("table", table.title, refKey, refKey);
}

function tableItem(table: TableMetadata): AssetCompletionItem {
  return {
    kind: "table",
    label: table.title,
    hint: table.tableLabel ?? pathSlug(table.path),
    snippet: tableInsertSnippet(table.path, table.title),
  };
}

function equationItem(equation: EquationMetadata, filePath: string): AssetCompletionItem {
  const mode = defaultEquationInsertMode(filePath);
  return {
    kind: "eq",
    label: equation.title,
    hint: equation.equationLabel ?? pathSlug(equation.path),
    snippet: equationInsertSnippet(equation.path, equation.title, mode),
  };
}

function referenceItem(ref: ReferenceMetadata): AssetCompletionItem | null {
  if (!ref.citeKey) return null;
  return {
    kind: "cite",
    label: `@${ref.citeKey}`,
    hint: [ref.authors, ref.year].filter(Boolean).join(", ") || ref.title,
    snippet: referenceInsertSnippet(ref.citeKey),
    citeKey: ref.citeKey,
  };
}

function rankItems<T>(
  items: T[],
  query: string,
  scoreFor: (item: T) => number,
  limit = 20,
): T[] {
  const scored = items
    .map((item) => ({ item, score: scoreFor(item) }))
    .filter(({ score }) => (query.trim() ? score >= 0 : true))
    .sort((a, b) => b.score - a.score || 0);

  return scored.slice(0, limit).map(({ item }) => item);
}

/** Build filtered completion items for the active trigger. */
export function buildAssetCompletions(
  assets: PaperAssetsBundle,
  trigger: AssetTrigger,
  filePath: string,
  references: ReferenceMetadata[] = [],
): AssetCompletionItem[] {
  const query = trigger.query;

  switch (trigger.kind) {
    case "fig":
      return rankItems(assets.figures, query, (fig) =>
        scoreAssetMatch(query, fig.title, fig.figureLabel, pathSlug(fig.path)),
      ).map((fig) => figureItem(fig, filePath));
    case "table":
      return rankItems(assets.tables, query, (table) =>
        scoreAssetMatch(query, table.title, table.tableLabel, pathSlug(table.path)),
      ).map((table) => tableItem(table));
    case "eq":
      return rankItems(assets.equations, query, (equation) =>
        scoreAssetMatch(query, equation.title, equation.equationLabel, pathSlug(equation.path)),
      ).map((equation) => equationItem(equation, filePath));
    case "cite": {
      const { filter } =
        trigger.citeMode === "open"
          ? parseOpenCitationKeys(query)
          : parseCiteTriggerKeys(query);
      return rankItems(
        references
          .map(referenceItem)
          .filter((item): item is AssetCompletionItem => item !== null),
        filter,
        (ref) => scoreAssetMatch(filter, ref.label, ref.hint, ref.citeKey),
      );
    }
    case "ref": {
      const figureItems = rankItems(assets.figures, query, (fig) =>
        scoreAssetMatch(query, fig.title, fig.figureLabel, figureRefKeyFromMeta(fig), pathSlug(fig.path)),
      ).map((fig) => figureCrossRefItem(fig));
      const tableItems = rankItems(assets.tables, query, (table) =>
        scoreAssetMatch(query, table.title, table.tableLabel, tableRefKeyFromMeta(table), pathSlug(table.path)),
      ).map((table) => tableCrossRefItem(table));
      return [...figureItems, ...tableItems].slice(0, 20);
    }
    default:
      return [];
  }
}

export function applyAssetCompletion(
  text: string,
  trigger: AssetTrigger,
  item: AssetCompletionItem,
): { value: string; cursor: number } {
  if (trigger.kind === "cite" && item.citeKey) {
    return appendReferenceCompletion(text, trigger, item.citeKey);
  }
  const value = `${text.slice(0, trigger.start)}${item.snippet}${text.slice(trigger.end)}`;
  return { value, cursor: trigger.start + item.snippet.length };
}

/** Add one cite key and keep the trigger open for the next pick. */
export function appendReferenceCompletion(
  text: string,
  trigger: AssetTrigger,
  citeKey: string,
): { value: string; cursor: number } {
  const payload = {
    start: trigger.start,
    end: trigger.end,
    query: trigger.query,
    rawCommand: trigger.rawCommand,
    mode: trigger.citeMode,
  };
  if (trigger.citeMode === "open") {
    return appendOpenCitationKey(text, trigger.start, trigger.end, trigger.query, citeKey);
  }
  return appendCiteTriggerKey(text, payload, citeKey);
}

export function applyReferenceCompletion(
  text: string,
  trigger: AssetTrigger,
  citeKeys: string[],
): { value: string; cursor: number } {
  return applyReferenceInsertion(text, trigger.end, citeKeys, {
    start: trigger.start,
    end: trigger.end,
    query: trigger.query,
    rawCommand: trigger.rawCommand,
    mode: trigger.citeMode,
  });
}

export function finishReferenceCompletion(
  text: string,
  trigger: AssetTrigger,
): { value: string; cursor: number } {
  return finalizeCiteTrigger(text, {
    start: trigger.start,
    end: trigger.end,
    query: trigger.query,
    rawCommand: trigger.rawCommand,
    mode: trigger.citeMode,
  });
}

export function pendingCiteKeysFromTrigger(trigger: AssetTrigger): string[] {
  if (trigger.kind !== "cite") return [];
  const parsed =
    trigger.citeMode === "open"
      ? parseOpenCitationKeys(trigger.query)
      : parseCiteTriggerKeys(trigger.query);
  return parsed.committed;
}

/** True when the caret is still inside the active autocomplete trigger session. */
export function shouldKeepAutocompleteOpen(
  text: string,
  selectionStart: number,
  activeTrigger: AssetTrigger | null,
): boolean {
  if (!activeTrigger) return true;
  if (selectionStart < activeTrigger.start) return false;

  const live = detectAssetTrigger(text, selectionStart);
  if (!live) return false;
  return live.start === activeTrigger.start && live.kind === activeTrigger.kind;
}

/** Active cite search text — only the segment after the last comma or semicolon. */
export function citeFilterFromTrigger(trigger: AssetTrigger): string {
  if (trigger.kind !== "cite") return trigger.query;
  const parsed =
    trigger.citeMode === "open"
      ? parseOpenCitationKeys(trigger.query)
      : parseCiteTriggerKeys(trigger.query);
  return parsed.filter;
}

export const CITE_SEARCH_HELP = [
  "Type to filter references.",
  "Enter or click adds a ref and opens the next slot (; or ,).",
  "After ; or ,, search uses only the text that follows.",
  "Attached refs show a checkmark and appear in the bar above.",
  "Click elsewhere in the text to dismiss and keep editing.",
  "↑↓ moves within the list (stops at ends).",
  "⌘/Ctrl+Enter or Esc finishes the citation.",
  "Space toggles multi-select; Shift+click also toggles.",
] as const;

export function shouldResetAutocompleteSelection(
  prevTrigger: AssetTrigger | null,
  nextTrigger: AssetTrigger,
): boolean {
  if (!prevTrigger || prevTrigger.start !== nextTrigger.start || prevTrigger.kind !== nextTrigger.kind) {
    return true;
  }

  if (nextTrigger.kind === "cite") {
    const prevCommitted = pendingCiteKeysFromTrigger(prevTrigger).length;
    const nextCommitted = pendingCiteKeysFromTrigger(nextTrigger).length;
    if (nextCommitted > prevCommitted) return true;

    const prevFilter = citeFilterFromTrigger(prevTrigger);
    const nextFilter = citeFilterFromTrigger(nextTrigger);
    if (nextFilter.length < prevFilter.length) return true;
    return !nextFilter.startsWith(prevFilter);
  }

  const prevQuery = prevTrigger.query;
  const nextQuery = nextTrigger.query;
  if (nextQuery.length < prevQuery.length) return true;
  return !nextQuery.startsWith(prevQuery);
}

export function assetCommandLabel(kind: AssetCommandKind): string {
  return ASSET_COMMAND_HELP.find((entry) => entry.kind === kind)?.label ?? kind;
}
