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

export function figureRefKeyFromMeta(meta: { figureLabel: string | null; path: string }): string {
  if (meta.figureLabel?.trim()) return meta.figureLabel.trim();
  return figureRefKeyFromPath(meta.path);
}

export function tableRefKeyFromMeta(meta: { tableLabel: string | null; path: string }): string {
  if (meta.tableLabel?.trim()) return meta.tableLabel.trim();
  const base = meta.path.trim().replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop();
  return base ? `tab:${base}` : "tab:unknown";
}

export function crossRefInsertSnippet(refKey: string): string {
  return `\\ref{${refKey}}`;
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

function normalizeFigurePath(target: string): string {
  return target
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/INDEX\.md$/i, "")
    .replace(/\.md$/, "");
}

/** True when a wikilink or figure:// href target points at a figure unit folder. */
export function isFigureAssetPath(target: string): boolean {
  const trimmed = normalizeFigurePath(target);
  if (!trimmed.includes("/figures/")) return false;
  const isFigureCandidate =
    !trimmed.endsWith(".md") || trimmed.includes("/notes/data/");
  return isFigureCandidate;
}

function pushUniqueFigurePath(paths: string[], seen: Set<string>, target: string): void {
  if (!isFigureAssetPath(target)) return;
  const normalized = normalizeFigurePath(target);
  if (seen.has(normalized)) return;
  seen.add(normalized);
  paths.push(normalized);
}

/** Figure paths from [[…/figures/…|label]] wikilinks and [label](figure://…) markdown links. */
export function listFigureWikilinkPaths(markdown: string): string[] {
  if (parseEmbedBlock(markdown)) return [];
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const match of markdown.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
    pushUniqueFigurePath(paths, seen, match[1] ?? "");
  }

  for (const match of markdown.matchAll(/\[[^\]]+\]\(figure:\/\/([^)]+)\)/g)) {
    pushUniqueFigurePath(paths, seen, match[1] ?? "");
  }

  return paths;
}

/** Unique figure paths referenced inline (::figure or wikilink) — shown after the paragraph. */
export function listDeferredFigurePaths(markdown: string): string[] {
  if (parseEmbedBlock(markdown)) return [];
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const target of [...listInlineFigureEmbedPaths(markdown), ...listFigureWikilinkPaths(markdown)]) {
    pushUniqueFigurePath(paths, seen, target);
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
