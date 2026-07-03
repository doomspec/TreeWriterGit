import { stripInlineComments } from "@/lib/inlineComments";
import { stripTextHighlightMacrosForDiff } from "@/lib/textHighlight";

function normalizeForApprovalDiff(text: string): string {
  return stripTextHighlightMacrosForDiff(stripInlineComments(text));
}

export type DiffLineKind = "equal" | "insert" | "delete";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

export type InlineSegment = {
  text: string;
  kind: "equal" | "insert" | "delete";
};

export type PendingLineHighlight =
  | { kind: "equal"; text: string }
  | { kind: "full"; text: string }
  | { kind: "delete"; text: string }
  | { kind: "inline"; segments: InlineSegment[] };

export function splitLines(text: string): string[] {
  if (!text) return [""];
  return text.split("\n");
}

type DiffToken = {
  raw: string;
  key: string;
};

function normalizeTokenKey(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}]+$/u, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .toLowerCase();
}

function tokenize(line: string): DiffToken[] {
  if (!line) return [];
  const parts = line.match(/\S+|\s+/g) ?? [];
  return parts.map((raw) => ({
    raw,
    key: /\s/.test(raw) ? raw : normalizeTokenKey(raw) || raw,
  }));
}

function lcsDiffTokens(a: DiffToken[], b: DiffToken[]): DiffLine[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] =
        a[i].key === b[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i].key === b[j].key) {
      ops.push({ kind: "equal", text: a[i].raw });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "delete", text: a[i].raw });
      i += 1;
    } else {
      ops.push({ kind: "insert", text: b[j].raw });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ kind: "delete", text: a[i].raw });
    i += 1;
  }
  while (j < n) {
    ops.push({ kind: "insert", text: b[j].raw });
    j += 1;
  }
  return ops;
}

function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ kind: "equal", text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "delete", text: a[i] });
      i += 1;
    } else {
      ops.push({ kind: "insert", text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ kind: "delete", text: a[i] });
    i += 1;
  }
  while (j < n) {
    ops.push({ kind: "insert", text: b[j] });
    j += 1;
  }
  return ops;
}

function mergeTrackChangeSegments(ops: DiffLine[]): InlineSegment[] {
  const segments: InlineSegment[] = [];
  for (const op of ops) {
    const kind = op.kind === "equal" ? "equal" : op.kind === "insert" ? "insert" : "delete";
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.text += op.text;
    } else {
      segments.push({ text: op.text, kind });
    }
  }
  return segments.length > 0 ? segments : [{ text: "", kind: "equal" }];
}

export function diffWordSegments(before: string, after: string): InlineSegment[] {
  if (before === after) return [{ text: after, kind: "equal" }];
  return mergeTrackChangeSegments(lcsDiffTokens(tokenize(before), tokenize(after)));
}

/** Myers-style LCS line diff between approved (before) and pending (after) text. */
export function diffLineOps(before: string, after: string): DiffLine[] {
  return lcsDiff(splitLines(before), splitLines(after));
}

function pendingLineHighlightRowsFromOps(ops: DiffLine[], includeDeletedLines: boolean): PendingLineHighlight[] {
  const rows: PendingLineHighlight[] = [];
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op.kind === "equal") {
      rows.push({ kind: "equal", text: op.text });
      continue;
    }
    if (op.kind === "delete") {
      const next = ops[index + 1];
      if (next?.kind === "insert") {
        rows.push({ kind: "inline", segments: diffWordSegments(op.text, next.text) });
        index += 1;
      } else if (includeDeletedLines) {
        rows.push({ kind: "delete", text: op.text });
      }
      continue;
    }
    rows.push({ kind: "full", text: op.text });
  }
  return rows;
}

/** Per-line highlight rows aligned to the current document (for raw editor overlays). */
export function pendingCurrentLineHighlightRows(baseline: string, current: string): PendingLineHighlight[] {
  if (baseline === current) {
    return splitLines(current).map((text) => ({ kind: "equal", text }));
  }
  return pendingLineHighlightRowsFromOps(diffLineOps(baseline, current), false);
}

/** Full track-changes rows including removed lines until approved. */
export function pendingLineHighlightRows(baseline: string, current: string): PendingLineHighlight[] {
  if (baseline === current) {
    return splitLines(current).map((text) => ({ kind: "equal", text }));
  }
  return pendingLineHighlightRowsFromOps(diffLineOps(baseline, current), true);
}

/** One highlight kind per line in the pending (after) document. */
export function pendingLineHighlights(baseline: string, current: string): ("equal" | "insert")[] {
  return pendingCurrentLineHighlightRows(baseline, current).map((row) =>
    row.kind === "equal" ? "equal" : "insert",
  );
}

export function hasPendingDiff(baseline: string, current: string): boolean {
  return baseline !== current;
}

/**
 * Baseline for diff display: the approved snapshot, or last-loaded content when
 * never approved. `approvedBaseline` is `null` specifically when no approval
 * record exists yet — distinct from `""`, which means the unit WAS approved and
 * its approved snapshot happens to be empty. Conflating the two (e.g. via a
 * `.length > 0` check) makes a still-empty approved snapshot fall back to the
 * live loaded content as its own baseline, silently hiding any later edit as
 * "already approved" — the bug behind reported missing review highlighting.
 */
export function effectiveDiffBaseline(
  approvedBaseline: string | null,
  loadedContent: string,
): string {
  return approvedBaseline !== null ? approvedBaseline : loadedContent;
}

/** True when the editor content differs from the effective approval baseline. */
export function hasPendingApprovalDiff(
  approvedBaseline: string | null,
  loadedContent: string,
  current: string,
): boolean {
  const baseline = effectiveDiffBaseline(approvedBaseline, loadedContent);
  return normalizeForApprovalDiff(baseline) !== normalizeForApprovalDiff(current);
}

export function pendingChangesRows(
  approvedBaseline: string | null,
  loadedContent: string,
  current: string,
): PendingLineHighlight[] {
  const baseline = effectiveDiffBaseline(approvedBaseline, loadedContent);
  if (baseline === current) return [];
  return pendingLineHighlightRows(baseline, current).filter((row) => row.kind !== "equal");
}

export function countPendingChanges(baseline: string, current: string): { inserts: number; deletes: number } {
  const ops = diffLineOps(baseline, current);
  return {
    inserts: ops.filter((op) => op.kind === "insert").length,
    deletes: ops.filter((op) => op.kind === "delete").length,
  };
}

export function countPendingDisplayChanges(
  approvedBaseline: string | null,
  loadedContent: string,
  current: string,
): { changedLines: number; changedWords: number } {
  const rows = pendingChangesRows(approvedBaseline, loadedContent, current);
  let changedLines = 0;
  let changedWords = 0;
  for (const row of rows) {
    changedLines += 1;
    if (row.kind === "inline") {
      changedWords += row.segments.filter(
        (segment) => segment.kind === "insert" || segment.kind === "delete",
      ).length;
    }
  }
  return { changedLines, changedWords };
}
