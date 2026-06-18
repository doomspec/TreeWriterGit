export type DiffLineKind = "equal" | "insert" | "delete";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

export function splitLines(text: string): string[] {
  if (!text) return [""];
  return text.split("\n");
}

/** Myers-style LCS line diff between approved (before) and pending (after) text. */
export function diffLineOps(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
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

/** One highlight kind per line in the pending (after) document. */
export function pendingLineHighlights(baseline: string, current: string): ("equal" | "insert")[] {
  if (baseline === current) {
    return splitLines(current).map(() => "equal" as const);
  }
  const result: ("equal" | "insert")[] = [];
  for (const op of diffLineOps(baseline, current)) {
    if (op.kind === "equal") result.push("equal");
    else if (op.kind === "insert") result.push("insert");
  }
  return result;
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
