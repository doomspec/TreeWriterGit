import type { PendingReviewChangeSummary } from "@treewriter/shared";

function splitLines(text: string): string[] {
  if (!text) return [""];
  return text.split("\n");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Line-level LCS diff counts between approved baseline and current manuscript. */
export function summarizeManuscriptChanges(
  approved: string,
  current: string,
): PendingReviewChangeSummary {
  const a = splitLines(approved);
  const b = splitLines(current);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let addedLines = 0;
  let removedLines = 0;
  let changedWords = 0;
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removedLines += 1;
      changedWords += countWords(a[i] ?? "");
      i += 1;
    } else {
      addedLines += 1;
      changedWords += countWords(b[j] ?? "");
      j += 1;
    }
  }
  while (i < m) {
    removedLines += 1;
    changedWords += countWords(a[i] ?? "");
    i += 1;
  }
  while (j < n) {
    addedLines += 1;
    changedWords += countWords(b[j] ?? "");
    j += 1;
  }

  return { addedLines, removedLines, changedWords };
}
