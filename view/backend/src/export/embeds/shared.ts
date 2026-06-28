import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { resolveTableMetadata } from "../../tables.js";

export type ExportEmbedResult = {
  markdown: string;
  /** Model-relative asset paths to copy beside main.tex (basenames used in LaTeX). */
  assets: string[];
};

export const FIGURE_LINE = /^::figure\[([^\]]+)\]\s*$/;
export const EQUATION_LINE = /^::equation\[([^\]]+)\]\s*$/;

const TABLE_CAPTION_LINE =
  /^\*\*(.+?)\.\*\*(?:\s+_(.+?)_|\s+\*(.+?)\*|\s+([^_\n*]+))?\s*$/;

export function captionMarkdownToPlain(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\\hl\{[a-z]+\}\{([^}]*)\}/g, "$1")
    .replace(/\[@([^\]]+)\]/g, (_full, cites: string) =>
      cites
        .split(/[,;]/)
        .map((part) => part.trim().replace(/^@/, ""))
        .filter(Boolean)
        .join(", "),
    )
    .trim();
}

export function figureLabel(meta: { figureLabel: string | null; path: string }): string | null {
  if (meta.figureLabel?.trim()) return meta.figureLabel.trim();
  const base = path.posix.basename(meta.path);
  if (base) return `fig:${base}`;
  return null;
}

export function tableLabel(meta: { tableLabel: string | null; path: string }): string | null {
  if (meta.tableLabel?.trim()) return meta.tableLabel.trim();
  const base = path.posix.basename(meta.path);
  if (base) return `tab:${base}`;
  return null;
}

export function isTableTargetPath(target: string): boolean {
  return /\/tables(\/|$)/.test(target) || target.includes("/tables/");
}

export function isFigureTargetPath(target: string): boolean {
  return /\/figures(\/|$)/.test(target) || target.includes("/figures/");
}

export function isEquationTargetPath(target: string): boolean {
  return /\/equations(\/|$)/.test(target) || target.includes("/equations/");
}

export function collapseParagraphLines(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isInlineFigureLine(lines: string[], index: number): boolean {
  if (!FIGURE_LINE.test(lines[index]?.trim() ?? "")) return false;
  const hasBefore = lines.slice(0, index).some((line) => line.trim() && !FIGURE_LINE.test(line.trim()));
  const hasAfter = lines.slice(index + 1).some((line) => line.trim() && !FIGURE_LINE.test(line.trim()));
  return hasBefore && hasAfter;
}

function normalizeTableDraftForExport(draft: string, label: string | null): string {
  const lines = draft.split("\n");
  let idx = 0;
  let captionLine = "";
  const match = lines[0]?.match(TABLE_CAPTION_LINE);
  if (match) {
    const labelText = match[1].trim();
    const rest = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    captionLine = rest ? `${labelText}. ${rest}` : `${labelText}.`;
    idx = 1;
  }
  while (idx < lines.length && !lines[idx]?.trim()) idx += 1;
  const tablePart = lines.slice(idx).join("\n").trim();
  if (!tablePart && !captionLine) return `${draft}\n\n`;
  const suffix = label ? ` {#${label}}` : "";
  const pandocCaption = captionLine ? `Table: ${captionMarkdownToPlain(captionLine)}${suffix}\n\n` : "";
  return `${pandocCaption}${tablePart}\n\n`;
}

export async function buildTableMarkdownExport(
  modelRoot: string,
  meta: Awaited<ReturnType<typeof resolveTableMetadata>>,
): Promise<string> {
  if (!meta) return "";

  const draftPath = path.join(modelRoot, meta.path, "draft.md");
  if (existsSync(draftPath)) {
    const draft = (await readFile(draftPath, "utf8")).trim();
    if (draft) return normalizeTableDraftForExport(draft, tableLabel(meta));
  }

  const caption = meta.caption.trim() || meta.summary?.trim() || meta.title.trim();
  if (!caption) return "";
  const label = tableLabel(meta);
  return label ? `Table: ${captionMarkdownToPlain(caption)} {#${label}}\n\n` : `${caption}\n\n`;
}

export function stripPandocTableLabel(markdown: string): string {
  return markdown.replace(/\s*\{#[^}]+\}/g, "");
}
