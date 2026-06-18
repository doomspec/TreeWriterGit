export type DiffLineKind = "equal" | "insert" | "delete";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

export type InlineSegment = {
  text: string;
  kind: "equal" | "insert";
};

export type PendingLineHighlight =
  | { kind: "equal"; text: string }
  | { kind: "full"; text: string }
  | { kind: "inline"; segments: InlineSegment[] };

export function splitLines(text: string): string[] {
  if (!text) return [""];
  return text.split("\n");
}

function tokenize(line: string): string[] {
  if (!line) return [];
  return line.match(/\S+|\s+/g) ?? [];
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

function mergeAfterSegments(ops: DiffLine[]): InlineSegment[] {
  const segments: InlineSegment[] = [];
  for (const op of ops) {
    if (op.kind === "delete") continue;
    const kind = op.kind === "equal" ? "equal" : "insert";
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.text += op.text;
    } else {
      segments.push({ text: op.text, kind });
    }
  }
  return segments.length > 0 ? segments : [{ text: "", kind: "equal" }];
}

function diffWordSegments(before: string, after: string): InlineSegment[] {
  if (before === after) return [{ text: after, kind: "equal" }];
  return mergeAfterSegments(lcsDiff(tokenize(before), tokenize(after)));
}

/** Myers-style LCS line diff between approved (before) and pending (after) text. */
export function diffLineOps(before: string, after: string): DiffLine[] {
  return lcsDiff(splitLines(before), splitLines(after));
}

/** Per-line highlight rows for the pending document, with word-level marks on edited lines. */
export function pendingLineHighlightRows(baseline: string, current: string): PendingLineHighlight[] {
  if (baseline === current) {
    return splitLines(current).map((text) => ({ kind: "equal", text }));
  }

  const ops = diffLineOps(baseline, current);
  const rows: PendingLineHighlight[] = [];
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op.kind === "equal") {
      rows.push({ kind: "equal", text: op.text });
      continue;
    }
    if (op.kind !== "insert") continue;

    const prev = ops[index - 1];
    if (prev?.kind === "delete") {
      rows.push({ kind: "inline", segments: diffWordSegments(prev.text, op.text) });
    } else {
      rows.push({ kind: "full", text: op.text });
    }
  }
  return rows;
}

/** One highlight kind per line in the pending (after) document. */
export function pendingLineHighlights(baseline: string, current: string): ("equal" | "insert")[] {
  return pendingLineHighlightRows(baseline, current).map((row) =>
    row.kind === "equal" ? "equal" : "insert",
  );
}

export function hasPendingDiff(baseline: string, current: string): boolean {
  return baseline !== current;
}

export function countPendingChanges(baseline: string, current: string): { inserts: number; deletes: number } {
  const ops = diffLineOps(baseline, current);
  return {
    inserts: ops.filter((op) => op.kind === "insert").length,
    deletes: ops.filter((op) => op.kind === "delete").length,
  };
}
