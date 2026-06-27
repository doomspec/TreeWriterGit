import {
  effectiveDiffBaseline,
  diffWordSegments,
  pendingLineHighlightRows,
  splitLines,
  type PendingLineHighlight,
} from "@/lib/draftDiff";
import { splitMarkdownIntoBlocks, type MarkdownBlock } from "@/lib/markdownBlocks";
import { stripTextHighlightMacrosForDiff } from "@/lib/textHighlight";

function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function tokenizeForOverlap(text: string): string[] {
  return normalizeForMatch(text)
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]+$/u, "").replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
}

function wordOverlapRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(tokenizeForOverlap(a));
  const wordsB = new Set(tokenizeForOverlap(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap += 1;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function renderSegments(segments: ReturnType<typeof diffWordSegments>): string {
  return segments
    .map((segment) => {
      if (segment.kind === "insert") {
        return `<mark class="highlight-inline--pending">${escapeHtml(segment.text)}</mark>`;
      }
      if (segment.kind === "delete") {
        return `<del class="highlight-inline--deleted">${escapeHtml(segment.text)}</del>`;
      }
      return escapeHtml(segment.text);
    })
    .join("");
}

function fractionChanged(rows: PendingLineHighlight[]): number {
  if (rows.length === 0) return 0;
  const changed = rows.filter((row) => row.kind !== "equal").length;
  return changed / rows.length;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHighlightRow(row: PendingLineHighlight): string {
  if (row.kind === "equal") return row.text;
  if (row.kind === "delete") {
    return `<del class="highlight-inline--deleted">${escapeHtml(row.text)}</del>`;
  }
  if (row.kind === "full") {
    return `<mark class="highlight-inline--pending">${escapeHtml(row.text)}</mark>`;
  }
  return row.segments
    .map((segment) => {
      if (segment.kind === "insert") {
        return `<mark class="highlight-inline--pending">${escapeHtml(segment.text)}</mark>`;
      }
      if (segment.kind === "delete") {
        return `<del class="highlight-inline--deleted">${escapeHtml(segment.text)}</del>`;
      }
      return escapeHtml(segment.text);
    })
    .join("");
}

/** Inject track-change marks for pending insertions and deletions. */
export function applyPendingMarksToMarkdown(baseline: string, current: string): string | null {
  if (baseline === current) return null;

  const baselinePlain = stripTextHighlightMacrosForDiff(baseline);
  const currentPlain = stripTextHighlightMacrosForDiff(current);
  if (baselinePlain === currentPlain) return null;

  const baselineLines = splitLines(baselinePlain);
  const currentLines = splitLines(currentPlain);

  // Single-line blocks: word-level diff avoids showing the whole line as deleted + re-inserted.
  if (baselineLines.length === 1 && currentLines.length === 1) {
    const segments = diffWordSegments(baselinePlain, currentPlain);
    if (segments.some((segment) => segment.kind !== "equal")) {
      return renderSegments(segments);
    }
    return null;
  }

  const rows = pendingLineHighlightRows(baselinePlain, currentPlain);

  // Block realignment or large reflow — fall back to word-level diff on the whole block.
  if (fractionChanged(rows) > 0.6 && baselinePlain.trim() && currentPlain.trim()) {
    const segments = diffWordSegments(baselinePlain, currentPlain);
    if (segments.some((segment) => segment.kind !== "equal")) {
      return renderSegments(segments);
    }
  }

  return rows.map(renderHighlightRow).join("\n");
}

export function effectivePendingHighlightBaseline(
  approvedBaseline: string,
  loadedContent: string,
): string {
  return effectiveDiffBaseline(approvedBaseline, loadedContent);
}

export function baselineMarkdownForBlock(
  effectiveBaseline: string,
  blockIndex: number,
  currentBlockMarkdown: string,
): string {
  const baselineBlocks = splitMarkdownIntoBlocks(effectiveBaseline);
  const currentNorm = normalizeForMatch(currentBlockMarkdown);

  const exact = baselineBlocks.find((block) => normalizeForMatch(block.markdown) === currentNorm);
  if (exact) return exact.markdown;

  const atIndex = baselineBlocks[blockIndex]?.markdown;
  if (atIndex) {
    const atIndexNorm = normalizeForMatch(atIndex);
    if (
      atIndexNorm === currentNorm ||
      wordOverlapRatio(atIndexNorm, currentNorm) >= 0.45 ||
      currentNorm.startsWith(atIndexNorm.slice(0, Math.min(48, atIndexNorm.length))) ||
      atIndexNorm.startsWith(currentNorm.slice(0, Math.min(48, currentNorm.length)))
    ) {
      return atIndex;
    }
  }

  let best: { markdown: string; score: number } | null = null;
  for (const block of baselineBlocks) {
    const score = wordOverlapRatio(normalizeForMatch(block.markdown), currentNorm);
    if (score >= 0.45 && (!best || score > best.score)) {
      best = { markdown: block.markdown, score };
    }
  }
  if (best) return best.markdown;

  return atIndex ?? "";
}

/** Map each current block id to the best matching baseline block markdown. */
export function alignBaselineBlocksToCurrent(
  effectiveBaseline: string,
  currentBlocks: MarkdownBlock[],
): Map<string, string> {
  const baselineBlocks = splitMarkdownIntoBlocks(effectiveBaseline);
  const usedBaseline = new Set<number>();
  const aligned = new Map<string, string>();

  for (const [index, block] of currentBlocks.entries()) {
    const currentNorm = normalizeForMatch(block.markdown);

    const exactIndex = baselineBlocks.findIndex(
      (candidate, candidateIndex) =>
        !usedBaseline.has(candidateIndex) && normalizeForMatch(candidate.markdown) === currentNorm,
    );
    if (exactIndex >= 0) {
      usedBaseline.add(exactIndex);
      aligned.set(block.id, baselineBlocks[exactIndex].markdown);
      continue;
    }

    let bestIndex = -1;
    let bestScore = 0;
    for (const [candidateIndex, candidate] of baselineBlocks.entries()) {
      if (usedBaseline.has(candidateIndex)) continue;
      const score = wordOverlapRatio(normalizeForMatch(candidate.markdown), currentNorm);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    }

    if (bestIndex >= 0 && bestScore >= 0.45) {
      usedBaseline.add(bestIndex);
      aligned.set(block.id, baselineBlocks[bestIndex].markdown);
      continue;
    }

    if (baselineBlocks[index] && !usedBaseline.has(index)) {
      usedBaseline.add(index);
      aligned.set(block.id, baselineBlocks[index].markdown);
      continue;
    }

    aligned.set(block.id, baselineMarkdownForBlock(effectiveBaseline, index, block.markdown));
  }

  return aligned;
}

export function markdownWithPendingHighlights(
  approvedBaseline: string,
  loadedContent: string,
  current: string,
): string | null {
  const baseline = effectivePendingHighlightBaseline(approvedBaseline, loadedContent);
  return applyPendingMarksToMarkdown(baseline, current);
}

export function blockMarkdownWithPendingHighlights(
  approvedBaseline: string,
  loadedContent: string,
  blockIndex: number,
  blockMarkdown: string,
): string | null {
  const baseline = baselineMarkdownForBlock(
    effectivePendingHighlightBaseline(approvedBaseline, loadedContent),
    blockIndex,
    blockMarkdown,
  );
  return applyPendingMarksToMarkdown(baseline, blockMarkdown);
}
