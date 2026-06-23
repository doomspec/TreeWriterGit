export type MarkdownBlock = {
  id: string;
  markdown: string;
};

let nextBlockId = 0;

function createBlockId(): string {
  nextBlockId += 1;
  return `blk-${nextBlockId}`;
}

/** Reset id counter — test helper only. */
export function resetBlockIdCounterForTests(): void {
  nextBlockId = 0;
}

function isHeadingLine(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim());
}

function isListLine(line: string): boolean {
  return /^(\s*)([-*+]|\d+\.)\s/.test(line);
}

/** Keep a blank line when it sits between a heading/label and the list that follows. */
function keepsHeadingWithList(current: string[]): boolean {
  if (current.length === 0) return false;
  const lastLine = current[current.length - 1]?.trim() ?? "";
  if (isHeadingLine(lastLine)) return true;
  if (/^[^:]+:$/.test(lastLine) && !lastLine.startsWith("#")) return true;
  return false;
}

/**
 * Split markdown into blocks on blank lines, respecting fenced code regions.
 */
export function splitMarkdownIntoBlocks(markdown: string): MarkdownBlock[] {
  const trimmed = markdown.trimEnd();
  if (!trimmed) return [];

  const lines = trimmed.split("\n");
  const segments: string[] = [];
  let current: string[] = [];
  let fenceOpen: string | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fenceOpen === null) {
        fenceOpen = marker[0];
      } else if (marker[0] === fenceOpen) {
        fenceOpen = null;
      }
    }

    if (line.trim() === "" && fenceOpen === null && current.length > 0) {
      const nextNonEmpty = lines.slice(lineIndex + 1).find((row) => row.trim() !== "") ?? "";
      if (keepsHeadingWithList(current) && isListLine(nextNonEmpty)) {
        current.push(line);
        continue;
      }

      segments.push(current.join("\n").trimEnd());
      current = [];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    segments.push(current.join("\n").trimEnd());
  }

  return segments
    .filter((segment) => segment.length > 0)
    .map((segment) => ({
      id: createBlockId(),
      markdown: segment,
    }));
}

export function joinMarkdownBlocks(blocks: MarkdownBlock[]): string {
  if (blocks.length === 0) return "";
  return blocks
    .map((block) => block.markdown.trimEnd())
    .filter(Boolean)
    .join("\n\n");
}

function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * When parent value changes externally, preserve block ids where content matches.
 */
export function reconcileBlocks(
  prev: MarkdownBlock[],
  nextMarkdown: string,
  forceReset = false,
): MarkdownBlock[] {
  const nextBlocks = splitMarkdownIntoBlocks(nextMarkdown);
  if (forceReset || prev.length === 0) return nextBlocks;

  const usedPrev = new Set<string>();
  return nextBlocks.map((nextBlock, index) => {
    const normalizedNext = normalizeForMatch(nextBlock.markdown);

    const contentMatch = prev.find(
      (prevBlock) =>
        !usedPrev.has(prevBlock.id) && normalizeForMatch(prevBlock.markdown) === normalizedNext,
    );
    if (contentMatch) {
      usedPrev.add(contentMatch.id);
      return { id: contentMatch.id, markdown: nextBlock.markdown };
    }

    const positional = prev[index];
    if (positional && !usedPrev.has(positional.id)) {
      usedPrev.add(positional.id);
      return { id: positional.id, markdown: nextBlock.markdown };
    }

    return nextBlock;
  });
}
