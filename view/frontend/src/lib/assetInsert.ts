/** Paper root path from any model path, e.g. `papers/roboculture/results/draft.md` → `papers/roboculture`. */
export function paperPathFromModelPath(modelPath: string): string | null {
  const match = modelPath.match(/^(papers\/[^/]+)/);
  return match?.[1] ?? null;
}

export function defaultFigureInsertMode(filePath: string): "embed" | "link" {
  return filePath.endsWith("/draft.md") ? "embed" : "link";
}

export function figureInsertSnippet(path: string, title: string, mode: "embed" | "link"): string {
  if (mode === "embed") {
    return `\n::figure[${path}]\n\n`;
  }
  return `[[${path}|${title}]]`;
}

export function tableInsertSnippet(path: string, title: string): string {
  return `[[${path}|${title}]]`;
}

export function equationInsertSnippet(path: string, title: string, mode: "embed" | "link"): string {
  if (mode === "embed") {
    return `\n::equation[${path}]\n\n`;
  }
  return `[[${path}|${title}]]`;
}

export function defaultEquationInsertMode(filePath: string): "embed" | "link" {
  return filePath.endsWith("/draft.md") ? "embed" : "link";
}

export function referenceInsertSnippet(citeKeys: string | string[]): string {
  const keys = normalizeCiteKeys(citeKeys);
  if (keys.length === 0) return "";
  if (keys.length === 1) return `[@${keys[0]}]`;
  return `[@${keys.join("; @")}]`;
}

export function normalizeCiteKeys(citeKeys: string | string[]): string[] {
  const list = Array.isArray(citeKeys) ? citeKeys : [citeKeys];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of list) {
    const trimmed = key.trim().replace(/^@/, "");
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

const CITE_SEGMENT_SPLIT = /[,;]/;

/** Keys already typed before the final comma/semicolon in \\cite{a, b} or \\cite{a; b}. */
export function parseCiteTriggerKeys(rawQuery: string): { committed: string[]; filter: string } {
  const parts = rawQuery.split(CITE_SEGMENT_SPLIT);
  if (parts.length === 1) {
    return { committed: [], filter: parts[0]?.trim().replace(/^@/, "") ?? "" };
  }
  const filter = parts[parts.length - 1]?.trim().replace(/^@/, "") ?? "";
  const committed = parts
    .slice(0, -1)
    .map((part) => part.trim().replace(/^@/, ""))
    .filter(Boolean);
  return { committed, filter };
}

/** Keys in an unclosed [@a; @b] citation before the cursor. */
export function parseOpenCitationKeys(inner: string): { committed: string[]; filter: string } {
  const parts = inner.split(CITE_SEGMENT_SPLIT);
  if (parts.length === 1) {
    return { committed: [], filter: parts[0]?.trim().replace(/^@/, "") ?? "" };
  }
  const filter = parts[parts.length - 1]?.trim().replace(/^@/, "") ?? "";
  const committed = parts
    .slice(0, -1)
    .map((part) => part.trim().replace(/^@/, ""))
    .filter(Boolean);
  return { committed, filter };
}

export function citeKeysFromTriggerQuery(query: string, mode: "command" | "open"): string[] {
  const parsed = mode === "open" ? parseOpenCitationKeys(query) : parseCiteTriggerKeys(query);
  return normalizeCiteKeys([...parsed.committed, ...(parsed.filter ? [parsed.filter] : [])]);
}

function citeCommandPrefix(text: string, triggerStart: number, triggerEnd: number): string {
  const head = text.slice(triggerStart, triggerEnd);
  const brace = head.indexOf("{");
  return brace >= 0 ? head.slice(0, brace + 1) : "\\cite{";
}

/** Append one key to an active \\cite{…} trigger and keep editing. */
export function appendCiteTriggerKey(
  text: string,
  trigger: ReferenceInsertTrigger & { rawCommand?: string },
  citeKey: string,
): { value: string; cursor: number } {
  const { committed } = parseCiteTriggerKeys(trigger.query);
  const keys = normalizeCiteKeys([...committed, citeKey]);
  const prefix = citeCommandPrefix(text, trigger.start, trigger.end);
  const newQuery = `${keys.join(", ")}, `;
  const value = `${text.slice(0, trigger.start)}${prefix}${newQuery}${text.slice(trigger.end)}`;
  const cursor = trigger.start + prefix.length + newQuery.length;
  return { value, cursor };
}

/** Append one key to an unclosed [@… citation and keep editing. */
export function appendOpenCitationKey(
  text: string,
  triggerStart: number,
  triggerEnd: number,
  inner: string,
  citeKey: string,
): { value: string; cursor: number } {
  const { committed } = parseOpenCitationKeys(inner);
  const keys = normalizeCiteKeys([...committed, citeKey]);
  const newInner = `${keys.map((key, index) => (index === 0 ? key : `@${key}`)).join("; ")}; `;
  const value = `${text.slice(0, triggerStart + 2)}${newInner}${text.slice(triggerEnd)}`;
  const cursor = triggerStart + 2 + newInner.length;
  return { value, cursor };
}

/** Convert an active cite trigger into a finished [@a; @b] citation. */
export function finalizeCiteTrigger(
  text: string,
  trigger: ReferenceInsertTrigger & { rawCommand?: string; mode?: "command" | "open" },
): { value: string; cursor: number } {
  if (trigger.mode === "open") {
    const keys = citeKeysFromTriggerQuery(trigger.query, "open");
    if (keys.length === 0) {
      return { value: `${text.slice(0, trigger.start)}${text.slice(trigger.end)}`, cursor: trigger.start };
    }
    const snippet = referenceInsertSnippet(keys);
    const value = `${text.slice(0, trigger.start)}${snippet}${text.slice(trigger.end)}`;
    return { value, cursor: trigger.start + snippet.length };
  }

  const keys = citeKeysFromTriggerQuery(trigger.query, "command");
  if (keys.length === 0) {
    return { value: `${text.slice(0, trigger.start)}${text.slice(trigger.end)}`, cursor: trigger.start };
  }
  const snippet = referenceInsertSnippet(keys);
  const value = `${text.slice(0, trigger.start)}${snippet}${text.slice(trigger.end)}`;
  return { value, cursor: trigger.start + snippet.length };
}

export function parsePartialCitationKeys(inner: string): string[] {
  return normalizeCiteKeys(inner.split(/[,;]/));
}

export type ReferenceInsertTrigger = {
  start: number;
  end: number;
  query: string;
  rawCommand?: string;
  mode?: "command" | "open";
};

/** Insert or extend grouped Pandoc citations [@a; @b]. */
export function applyReferenceInsertion(
  text: string,
  cursor: number,
  citeKeys: string | string[],
  trigger?: ReferenceInsertTrigger | null,
): { value: string; cursor: number } {
  const keys = normalizeCiteKeys(citeKeys);
  if (keys.length === 0) return { value: text, cursor };

  const before = text.slice(0, cursor);
  const openMatch = before.match(/\[@([^\]]*)$/);
  if (openMatch?.index !== undefined) {
    const start = openMatch.index;
    const existing = parsePartialCitationKeys(openMatch[1] ?? "");
    const snippet = referenceInsertSnippet([...existing, ...keys]);
    const value = `${text.slice(0, start)}${snippet}${text.slice(cursor)}`;
    return { value, cursor: start + snippet.length };
  }

  if (trigger) {
    const { committed } = parseCiteTriggerKeys(trigger.query);
    const snippet = referenceInsertSnippet([...committed, ...keys]);
    const value = `${text.slice(0, trigger.start)}${snippet}${text.slice(trigger.end)}`;
    return { value, cursor: trigger.start + snippet.length };
  }

  const snippet = referenceInsertSnippet(keys);
  const value = `${text.slice(0, cursor)}${snippet}${text.slice(cursor)}`;
  return { value, cursor: cursor + snippet.length };
}
