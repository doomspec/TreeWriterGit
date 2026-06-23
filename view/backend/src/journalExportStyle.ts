import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

/** Pandoc / LaTeX export styling from model/templates/{journal}.md `export:` frontmatter. */
export interface JournalExportStyle {
  documentclass?: string;
  documentclassOptions?: string[];
  geometry?: string;
  /** CSL filename under model/templates/ or model/shared/ */
  csl?: string;
  pandocVariables?: Record<string, string>;
  /** Raw LaTeX appended to the pandoc include-in-header snippet */
  latexHeader?: string;
  /** Template-relative .tex file under model/templates/ merged into the header */
  includeHeader?: string;
}

export function parseJournalExportStyle(raw: unknown): JournalExportStyle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const style: JournalExportStyle = {};

  if (typeof data.documentclass === "string" && data.documentclass.trim()) {
    style.documentclass = data.documentclass.trim();
  }
  if (Array.isArray(data.documentclass_options)) {
    const options = data.documentclass_options
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());
    if (options.length > 0) style.documentclassOptions = options;
  }
  if (typeof data.geometry === "string" && data.geometry.trim()) {
    style.geometry = data.geometry.trim();
  }
  if (typeof data.csl === "string" && data.csl.trim()) {
    style.csl = data.csl.trim();
  }
  if (data.pandoc_variables && typeof data.pandoc_variables === "object") {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.pandoc_variables as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) vars[key] = value.trim();
      else if (typeof value === "number" || typeof value === "boolean") vars[key] = String(value);
    }
    if (Object.keys(vars).length > 0) style.pandocVariables = vars;
  }
  if (typeof data.latex_header === "string" && data.latex_header.trim()) {
    style.latexHeader = data.latex_header;
  }
  if (typeof data.include_header === "string" && data.include_header.trim()) {
    style.includeHeader = data.include_header.trim();
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

export function buildJournalLatexHeader(style: JournalExportStyle): string {
  const lines: string[] = [];
  if (style.geometry) {
    lines.push(`\\usepackage[${style.geometry}]{geometry}`);
  }
  if (style.latexHeader?.trim()) {
    lines.push(style.latexHeader.trim());
  }
  return lines.join("\n");
}

export async function readTemplateIncludeHeader(
  modelRoot: string,
  includeHeader: string,
): Promise<string | null> {
  const normalized = includeHeader.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) return null;
  const abs = path.join(modelRoot, "templates", normalized);
  if (!existsSync(abs)) return null;
  return readFile(abs, "utf8");
}

export async function buildCombinedExportHeader(
  modelRoot: string,
  style: JournalExportStyle | undefined,
  inlineNotesPreamble?: string,
): Promise<string | undefined> {
  const parts: string[] = [];
  if (style) {
    const journalHeader = buildJournalLatexHeader(style);
    if (journalHeader) parts.push(journalHeader);
    if (style.includeHeader) {
      const included = await readTemplateIncludeHeader(modelRoot, style.includeHeader);
      if (included?.trim()) parts.push(included.trim());
    }
  }
  if (inlineNotesPreamble?.trim()) parts.push(inlineNotesPreamble.trim());
  if (parts.length === 0) return undefined;
  return `${parts.join("\n\n")}\n`;
}

/** Append pandoc CLI args for journal template export styling. */
export function appendPandocExportStyleArgs(args: string[], style: JournalExportStyle | undefined): void {
  if (!style) return;
  if (style.documentclass) {
    args.push("-V", `documentclass=${style.documentclass}`);
  }
  if (style.documentclassOptions?.length) {
    args.push("-V", `classoption=${style.documentclassOptions.join(",")}`);
  }
  if (style.pandocVariables) {
    for (const [key, value] of Object.entries(style.pandocVariables)) {
      args.push("-V", `${key}=${value}`);
    }
  }
}
