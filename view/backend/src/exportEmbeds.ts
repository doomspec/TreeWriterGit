import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { resolveEquationMetadata } from "./equations.js";
import { resolveFigureMetadata } from "./figures.js";
import { resolveTableMetadata } from "./tables.js";

export type ExportEmbedResult = {
  markdown: string;
  /** Model-relative asset paths to copy beside main.tex (basenames used in LaTeX). */
  assets: string[];
};

const FIGURE_LINE = /^::figure\[([^\]]+)\]\s*$/;
const EQUATION_LINE = /^::equation\[([^\]]+)\]\s*$/;
const FIGURE_REF_PREFIX = /(\(Fig\.|\bFig\.|\(Figure)\s*$/i;

function escapeLatexText(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}])/g, "\\$1")
    .replace(/([#%&_$])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function captionMarkdownToPlain(text: string): string {
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

function captionMarkdownToLatex(text: string): string {
  return escapeLatexText(captionMarkdownToPlain(text));
}

function figureLabel(meta: { figureLabel: string | null; path: string }): string | null {
  if (meta.figureLabel?.trim()) return meta.figureLabel.trim();
  const base = path.posix.basename(meta.path);
  if (base) return `fig:${base}`;
  return null;
}

function tableLabel(meta: { tableLabel: string | null; path: string }): string | null {
  if (meta.tableLabel?.trim()) return meta.tableLabel.trim();
  const base = path.posix.basename(meta.path);
  if (base) return `tab:${base}`;
  return null;
}

export function buildFigureLatexExport(
  meta: Awaited<ReturnType<typeof resolveFigureMetadata>>,
  captionOverride?: string,
): { latex: string; assetPath: string | null } {
  if (!meta) return { latex: "", assetPath: null };

  const caption =
    captionOverride?.trim() ||
    meta.caption.trim() ||
    meta.summary?.trim() ||
    meta.title.trim();
  if (!caption) return { latex: "", assetPath: null };

  if (meta.previewPath && !meta.previewPath.endsWith(".mmd")) {
    const assetName = path.posix.basename(meta.previewPath);
    const label = figureLabel(meta);
    const lines = [
      "\\begin{figure}[htbp]",
      "\\centering",
      `\\includegraphics[width=0.9\\linewidth]{${assetName}}`,
      `\\caption{${captionMarkdownToLatex(caption)}}`,
    ];
    if (label) lines.push(`\\label{${label}}`);
    lines.push("\\end{figure}", "");
    return { latex: lines.join("\n"), assetPath: meta.previewPath };
  }

  const note = meta.sourcePath ?? meta.path;
  return {
    latex: `${captionMarkdownToPlain(caption)}\n\n*(Mermaid figure: ${note})*\n\n`,
    assetPath: null,
  };
}

export function buildFigureExportPreamble(): string {
  return "\\usepackage{graphicx}";
}

async function readEquationSource(
  modelRoot: string,
  meta: NonNullable<Awaited<ReturnType<typeof resolveEquationMetadata>>>,
): Promise<string> {
  const abs = path.join(modelRoot, meta.sourcePath!);
  return (await readFile(abs, "utf8")).trim();
}

export async function buildEquationLatexExportAsync(
  modelRoot: string,
  meta: Awaited<ReturnType<typeof resolveEquationMetadata>>,
  captionOverride?: string,
): Promise<string> {
  if (!meta?.sourcePath) return "";
  const equationSource = await readEquationSource(modelRoot, meta);
  if (!equationSource) return "";

  const caption =
    captionOverride?.trim() ||
    meta.caption.trim() ||
    meta.summary?.trim() ||
    "";
  const label = meta.equationLabel?.trim() ? meta.equationLabel.trim() : null;

  const lines = ["\\begin{equation}", equationSource, "\\end{equation}"];
  if (label) lines.push(`\\label{${label}}`);
  if (caption) lines.push("", `*${captionMarkdownToPlain(caption)}*`);
  return `${lines.join("\n")}\n\n`;
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

const TABLE_CAPTION_LINE =
  /^\*\*(.+?)\.\*\*(?:\s+_(.+?)_|\s+\*(.+?)\*|\s+([^_\n*]+))?\s*$/;

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

function isTableTargetPath(target: string): boolean {
  return /\/tables(\/|$)/.test(target) || target.includes("/tables/");
}

function isFigureTargetPath(target: string): boolean {
  return /\/figures(\/|$)/.test(target) || target.includes("/figures/");
}

function isEquationTargetPath(target: string): boolean {
  return /\/equations(\/|$)/.test(target) || target.includes("/equations/");
}

function shouldConsumeTrailingCaptionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^#{1,6}\s/.test(trimmed)) return false;
  if (/^::(figure|equation)\[/.test(trimmed)) return false;
  if (trimmed.startsWith("|")) return false;
  if (/^\\begin\{/.test(trimmed)) return false;
  if (/^\[\[/.test(trimmed)) return false;
  return true;
}

function isInlineFigureLine(lines: string[], index: number): boolean {
  if (!FIGURE_LINE.test(lines[index]?.trim() ?? "")) return false;
  const hasBefore = lines.slice(0, index).some((line) => line.trim() && !FIGURE_LINE.test(line.trim()));
  const hasAfter = lines.slice(index + 1).some((line) => line.trim() && !FIGURE_LINE.test(line.trim()));
  return hasBefore && hasAfter;
}

function collapseParagraphLines(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function expandInlineFigureLinesInParagraph(
  modelRoot: string,
  lines: string[],
  assets: string[],
): Promise<{ lines: string[]; deferred: string[] }> {
  const deferred: string[] = [];
  const nextLines = [...lines];

  for (let i = 0; i < nextLines.length; i += 1) {
    const match = FIGURE_LINE.exec(nextLines[i]?.trim() ?? "");
    if (!match || !isInlineFigureLine(nextLines, i)) continue;

    const meta = await resolveFigureMetadata(modelRoot, match[1].trim());
    if (!meta) continue;
    const label = figureLabel(meta);
    if (!label) continue;

    const { latex, assetPath } = buildFigureLatexExport(meta);
    if (latex) {
      deferred.push(latex);
      if (assetPath && !assets.includes(assetPath)) assets.push(assetPath);
    }

    const prev = nextLines[i - 1]?.trim() ?? "";
    const next = nextLines[i + 1]?.trim() ?? "";

    if (FIGURE_REF_PREFIX.test(prev) && next.startsWith(")")) {
      nextLines[i - 1] = prev.replace(FIGURE_REF_PREFIX, `$1~\\ref{${label}}`) + next;
      nextLines.splice(i, 2);
      i -= 1;
      continue;
    }

    if (FIGURE_REF_PREFIX.test(prev)) {
      nextLines[i - 1] = prev.replace(FIGURE_REF_PREFIX, `$1~\\ref{${label}}`);
      nextLines.splice(i, 1);
      i -= 1;
      continue;
    }

    nextLines[i] = `\\ref{${label}}`;
  }

  return { lines: nextLines, deferred };
}

async function expandParagraphEmbeds(
  modelRoot: string,
  paragraph: string,
  assets: string[],
): Promise<string> {
  const trimmed = paragraph.trim();
  if (!trimmed) return "";

  if (FIGURE_LINE.test(trimmed) && !trimmed.includes("\n")) {
    const meta = await resolveFigureMetadata(modelRoot, FIGURE_LINE.exec(trimmed)![1].trim());
    const { latex, assetPath } = buildFigureLatexExport(meta);
    if (latex) {
      if (assetPath && !assets.includes(assetPath)) assets.push(assetPath);
      return latex;
    }
  }

  if (EQUATION_LINE.test(trimmed) && !trimmed.includes("\n")) {
    const meta = await resolveEquationMetadata(modelRoot, EQUATION_LINE.exec(trimmed)![1].trim());
    const latex = await buildEquationLatexExportAsync(modelRoot, meta);
    if (latex.trim()) return latex;
  }

  const tableLineMatch = /^\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]\s*$/.exec(trimmed);
  if (tableLineMatch && isTableTargetPath(tableLineMatch[1].trim())) {
    const meta = await resolveTableMetadata(modelRoot, tableLineMatch[1].trim());
    const tableMd = await buildTableMarkdownExport(modelRoot, meta);
    if (tableMd.trim()) return tableMd;
  }

  let lines = trimmed.split("\n");
  const deferredFloats: string[] = [];

  if (lines.some((line) => FIGURE_LINE.test(line.trim()))) {
    const inline = await expandInlineFigureLinesInParagraph(modelRoot, lines, assets);
    lines = inline.lines;
    deferredFloats.push(...inline.deferred);
  }

  for (let i = 0; i < lines.length; i += 1) {
    const equationMatch = EQUATION_LINE.exec(lines[i]?.trim() ?? "");
    if (!equationMatch) continue;
    const meta = await resolveEquationMetadata(modelRoot, equationMatch[1].trim());
    const latex = await buildEquationLatexExportAsync(modelRoot, meta);
    if (!latex.trim()) continue;
    deferredFloats.push(latex.trim());
    lines.splice(i, 1);
    i -= 1;
  }

  const body = collapseParagraphLines(lines);
  if (!body && deferredFloats.length === 0) return trimmed;

  const parts: string[] = [];
  if (body) parts.push(body);
  if (deferredFloats.length > 0) parts.push(deferredFloats.join("\n\n"));
  return parts.join("\n\n");
}

async function expandInlineTableWikilinks(
  modelRoot: string,
  markdown: string,
): Promise<string> {
  const re = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(markdown)) !== null) {
    parts.push(markdown.slice(lastIndex, match.index));
    const target = match[1].trim();
    const alias = match[2]?.trim();
    if (isTableTargetPath(target)) {
      const meta = await resolveTableMetadata(modelRoot, target);
      const label = meta ? tableLabel(meta) : null;
      if (label) {
        parts.push(alias ? `${alias}~\\ref{${label}}` : `\\ref{${label}}`);
      } else {
        parts.push(alias ?? target);
      }
    } else if (isFigureTargetPath(target)) {
      const meta = await resolveFigureMetadata(modelRoot, target);
      const label = meta ? figureLabel(meta) : null;
      if (label) {
        parts.push(alias ? `${alias}~\\ref{${label}}` : `\\ref{${label}}`);
      } else {
        parts.push(alias ?? target);
      }
    } else if (isEquationTargetPath(target)) {
      const meta = await resolveEquationMetadata(modelRoot, target);
      const label = meta?.equationLabel?.trim();
      if (label) {
        parts.push(alias ? `${alias}~\\ref{${label}}` : `\\ref{${label}}`);
      } else {
        parts.push(alias ?? target);
      }
    } else {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  parts.push(markdown.slice(lastIndex));
  return parts.join("");
}

/** Expand ::figure / ::equation embeds and table wikilinks to export-ready markdown/LaTeX. */
export async function expandManuscriptEmbedsForExport(
  modelRoot: string,
  markdown: string,
): Promise<ExportEmbedResult> {
  const assets: string[] = [];
  const paragraphs = markdown.split(/\n\n+/);
  const expanded = await Promise.all(
    paragraphs.map((paragraph) => expandParagraphEmbeds(modelRoot, paragraph, assets)),
  );
  let result = expanded.filter(Boolean).join("\n\n");
  result = await expandInlineTableWikilinks(modelRoot, result);
  return { markdown: result, assets: [...new Set(assets)] };
}
