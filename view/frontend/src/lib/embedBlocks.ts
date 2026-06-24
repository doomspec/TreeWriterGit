import { EQUATION_BLOCK_LANG, FIGURE_BLOCK_LANG } from "@/lib/modelTree";

export type EmbedBlockKind = "figure" | "equation";

export type ParsedEmbedBlock = {
  kind: EmbedBlockKind;
  targetPath: string;
};

const FIGURE_ONLY = /^::figure\[([^\]]+)\]\s*$/;
const EQUATION_ONLY = /^::equation\[([^\]]+)\]\s*$/;

function neighboringNonEmptyLines(
  lines: string[],
  index: number,
): { prev: string | null; next: string | null } {
  let prev: string | null = null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const trimmed = lines[i]?.trim() ?? "";
    if (trimmed) {
      prev = trimmed;
      break;
    }
  }
  let next: string | null = null;
  for (let i = index + 1; i < lines.length; i += 1) {
    const trimmed = lines[i]?.trim() ?? "";
    if (trimmed) {
      next = trimmed;
      break;
    }
  }
  return { prev, next };
}

/** True when an embed line sits inside a paragraph (text before and after on adjacent lines). */
export function isInlineEmbedLine(lines: string[], index: number): boolean {
  const trimmed = lines[index]?.trim() ?? "";
  if (!FIGURE_ONLY.test(trimmed) && !EQUATION_ONLY.test(trimmed)) return false;
  const { prev, next } = neighboringNonEmptyLines(lines, index);
  return Boolean(prev && next);
}

export function figureRefKeyFromPath(targetPath: string): string {
  const base = targetPath.trim().replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop();
  return base ? `fig:${base}` : "fig:unknown";
}

/** Replace inline ::figure[path] tokens with \\ref{fig:…} for rendered display. */
export function replaceInlineFigureEmbedsWithRefs(markdown: string): {
  markdown: string;
  figurePaths: string[];
} {
  const figurePaths: string[] = [];
  const replaced = markdown.replace(/::figure\[([^\]]+)\]/g, (_full, target: string) => {
    const path = target.trim();
    figurePaths.push(path);
    return `\\ref{${figureRefKeyFromPath(path)}}`;
  });
  return { markdown: replaced, figurePaths };
}

/** List ::figure[path] targets that appear inline within a markdown block. */
export function listInlineFigureEmbedPaths(markdown: string): string[] {
  if (parseEmbedBlock(markdown)) return [];
  const lines = markdown.split("\n");
  const paths: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = FIGURE_ONLY.exec(lines[i]?.trim() ?? "");
    if (match && isInlineEmbedLine(lines, i)) {
      paths.push(match[1].trim());
    }
  }
  return paths;
}

/** Isolate standalone ::figure / ::equation lines; keep inline embeds inside their paragraph. */
export function expandEmbedBlocksInMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if ((FIGURE_ONLY.test(trimmed) || EQUATION_ONLY.test(trimmed)) && !isInlineEmbedLine(lines, i)) {
      if (out.length > 0 && out[out.length - 1]?.trim() !== "") {
        out.push("");
      }
      out.push(trimmed);
      out.push("");
      continue;
    }
    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** True when a block is only a figure or equation embed directive. */
export function parseEmbedBlock(markdown: string): ParsedEmbedBlock | null {
  const trimmed = markdown.trim();
  if (!trimmed) return null;

  let match = FIGURE_ONLY.exec(trimmed);
  if (match) {
    return { kind: "figure", targetPath: match[1].trim() };
  }

  match = EQUATION_ONLY.exec(trimmed);
  if (match) {
    return { kind: "equation", targetPath: match[1].trim() };
  }

  match = new RegExp(`^\`\`\`${FIGURE_BLOCK_LANG}\\s*\\n([\\s\\S]*?)\\n\`\`\`\s*$`).exec(trimmed);
  if (match) {
    return { kind: "figure", targetPath: match[1].trim() };
  }

  match = new RegExp(`^\`\`\`${EQUATION_BLOCK_LANG}\\s*\\n([\\s\\S]*?)\\n\`\`\`\s*$`).exec(trimmed);
  if (match) {
    return { kind: "equation", targetPath: match[1].trim() };
  }

  return null;
}
