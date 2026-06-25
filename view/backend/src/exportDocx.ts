import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import markdownDocx, { Packer, type MarkdownImageAdapter } from "markdown-docx";
import type { Tokens } from "marked";

import {
  buildCombinedMarkdown,
  countUnitSources,
  type ExportPaperInput,
  type ExportPaperResult,
  patchLastExport,
} from "./export.js";
import { DOCX_ASSET_URL_PREFIX, expandManuscriptEmbedsForDocx } from "./exportEmbedsDocx.js";
import {
  resolveExportBibliography,
  assertExportAllowed,
  paperHasUnapprovedUnits,
} from "./export/runExportPipeline.js";
import { validatePaperCrossRefs } from "./crossRefValidation.js";
import {
  collectDocxOutlineComments,
  insertDocxAbstractHeading,
} from "./exportDocxStructure.js";
import {
  flattenInlineMathToUnicodeForDocx,
  normalizeManuscriptMathForExport,
  normalizeTextHighlightMacros,
} from "./exportMarkdown.js";
import {
  buildMarkdownDocxExportOptions,
  postProcessDocxExport,
} from "./exportDocxStyle.js";
import { stripInlineNotes } from "./inlineNotes.js";
import { type JournalExportStyle } from "./journalExportStyle.js";
import { ModelFsError } from "./modelFs.js";
import { loadJournalTemplate } from "./papers.js";
import { paperLiteratureDir } from "./paperAssets.js";

function stripTreeWriterAuthorNotes(markdown: string): string {
  return stripInlineNotes(markdown)
    .replace(/\\todo\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\hl\{[a-z]+\}\{([^}]*)\}/g, "$1")
    .replace(/\\(cite|fig|table|eq)\{([^}]*)\}/g, (_full, _macro: string, inner: string) => inner)
    .replace(/\s+\n/g, "\n");
}

function formatLiteratureReference(data: Record<string, unknown>, citeKey: string): string {
  const authors = data.authors ? String(data.authors) : "";
  const year = data.year ? String(data.year) : "n.d.";
  const title = data.title ? String(data.title) : citeKey;
  const journal = data.journal ? String(data.journal) : "";
  const authorPart = authors ? `${authors} (${year}).` : `(${year}).`;
  const journalPart = journal ? ` *${journal}*.` : "";
  return `${authorPart} ${title}.${journalPart}`.replace(/\s+/g, " ").trim();
}

async function appendReferencesSection(
  modelRoot: string,
  paperRel: string,
  markdown: string,
  _bibliography: string,
): Promise<string> {
  const citedKeys = new Set<string>();
  for (const match of markdown.matchAll(/\[@([^\]]+)\]/g)) {
    for (const part of match[1]?.split(/[,;]/) ?? []) {
      const key = part.trim().replace(/^@/, "");
      if (key) citedKeys.add(key);
    }
  }
  if (citedKeys.size === 0) return markdown;

  const literatureDir = path.join(modelRoot, paperLiteratureDir(paperRel));
  const entries: string[] = [];
  if (existsSync(literatureDir)) {
    for (const file of await readdir(literatureDir)) {
      if (!file.endsWith(".md") || file === "INDEX.md") continue;
      const raw = await readFile(path.join(literatureDir, file), "utf8");
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;
      if (data.type !== "literature" && !data.cite_key) continue;
      const citeKey = String(data.cite_key ?? file.replace(/\.md$/, ""));
      if (!citedKeys.has(citeKey)) continue;
      entries.push(`- ${formatLiteratureReference(data, citeKey)}`);
    }
  }

  entries.sort();
  if (entries.length === 0) return markdown;

  return `${markdown.trim()}\n\n## References\n\n${entries.join("\n")}\n`;
}

function isDocxStructuralLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^\|.+\|$/.test(trimmed)) return true;
  if (/^>\s/.test(trimmed)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return true;
  return false;
}

function isDocxListLine(line: string): boolean {
  return /^([-*+]|\d+\.)\s/.test(line.trim());
}

/** Turn single newlines in prose into blank-line paragraph breaks for Word. */
export function normalizeDocxParagraphBreaks(markdown: string): string {
  const parts: string[] = [];
  const fenceRe = /(```[\s\S]*?```)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(markdown)) !== null) {
    parts.push(normalizeDocxParagraphBreaksInSegment(markdown.slice(lastIndex, match.index)));
    parts.push(match[1]!);
    lastIndex = match.index + match[1]!.length;
  }

  parts.push(normalizeDocxParagraphBreaksInSegment(markdown.slice(lastIndex)));
  return parts.join("");
}

function normalizeDocxParagraphBreaksInSegment(segment: string): string {
  const lines = segment.split("\n");
  if (lines.length <= 1) return segment;

  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    out.push(lines[i]!);
    if (i >= lines.length - 1) break;

    const current = lines[i]!;
    const next = lines[i + 1]!;
    if (!current.trim() || !next.trim()) continue;
    if (isDocxListLine(current) && isDocxListLine(next)) continue;
    if (isDocxStructuralLine(current) || isDocxStructuralLine(next)) {
      out.push("");
      continue;
    }
    out.push("");
  }

  return out.join("\n");
}

/** Clean combined manuscript markdown for markdown-docx conversion. */
export function prepareMarkdownForDocxExport(markdown: string): string {
  let result = stripTreeWriterAuthorNotes(markdown);
  result = normalizeTextHighlightMacros(result);
  result = normalizeManuscriptMathForExport(result);
  result = flattenInlineMathToUnicodeForDocx(result);
  result = result.replace(/\[@([^\]]+)\]/g, (_full, cites: string) => {
    const keys = cites
      .split(/[,;]/)
      .map((part: string) => part.trim().replace(/^@/, ""))
      .filter(Boolean);
    return keys.length ? `(${keys.join("; ")})` : "";
  });
  result = normalizeDocxParagraphBreaks(result);
  return result.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function createDocxImageAdapter(modelRoot: string): MarkdownImageAdapter {
  return async (token: Tokens.Image) => {
    const href = token.href?.trim() ?? "";
    if (!href.startsWith(DOCX_ASSET_URL_PREFIX)) return null;

    const rel = href.slice(DOCX_ASSET_URL_PREFIX.length);
    const abs = path.join(modelRoot, rel);
    if (!existsSync(abs)) return null;

    const data = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const type =
      ext === ".jpg" || ext === ".jpeg"
        ? "jpg"
        : ext === ".gif"
          ? "gif"
          : ext === ".bmp"
            ? "bmp"
            : "png";

    return {
      type,
      data,
      width: 480,
      height: 360,
    };
  };
}

export async function exportPaperDocx(
  modelRoot: string,
  repoRoot: string,
  input: ExportPaperInput,
): Promise<ExportPaperResult> {
  const paperRel = `papers/${input.paperSlug.trim()}`;
  const paperIndex = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(paperIndex)) {
    throw new ModelFsError(`Paper not found: ${input.paperSlug}`, 404);
  }

  const includeDrafts = Boolean(input.includeDrafts);
  const { markdown: combinedRawBase, unitCount } = await buildCombinedMarkdown(
    modelRoot,
    paperRel,
    includeDrafts,
  );
  const combinedRaw = insertDocxAbstractHeading(combinedRawBase);
  const outlineComments = await collectDocxOutlineComments(modelRoot, paperRel);

  if (unitCount === 0) {
    const stats = await countUnitSources(modelRoot, paperRel, includeDrafts);
    const message = includeDrafts
      ? stats.units === 0
        ? "Nothing to export — no units found in this paper."
        : "Nothing to export — no unit draft.md files with content."
      : stats.withDraft > 0
        ? "Nothing to export — no approved drafts. Enable \"Include non-approved drafts\"."
        : "Nothing to export — no units with status: approved.";
    throw new ModelFsError(message, 400);
  }

  const paperData = matter(await readFile(paperIndex, "utf8")).data as Record<string, unknown>;
  const journal = String(paperData.journal ?? "");
  let exportStyle: JournalExportStyle | undefined;
  try {
    const template = await loadJournalTemplate(modelRoot, journal);
    exportStyle = template.export;
  } catch {
    exportStyle = undefined;
  }

  const exportDir = path.join(repoRoot, ".treewriter-exports");
  const { bibliography, missingCitations } = await resolveExportBibliography(
    modelRoot,
    paperRel,
    combinedRaw,
    journal,
    exportStyle,
    exportDir,
  );
  const { orphanCrossRefs } = await validatePaperCrossRefs(modelRoot, paperRel, combinedRaw);
  assertExportAllowed(
    {
      orphanCrossRefs,
      missingCitations,
      hasUnapprovedUnits: await paperHasUnapprovedUnits(modelRoot, paperRel),
    },
    { ...(input.validation ?? {}), includeDrafts },
  );

  const expanded = await expandManuscriptEmbedsForDocx(modelRoot, paperRel, combinedRaw);
  let combined = prepareMarkdownForDocxExport(expanded.markdown);

  await mkdir(exportDir, { recursive: true });
  combined = await appendReferencesSection(modelRoot, paperRel, combined, bibliography);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${input.paperSlug}-${stamp}`;
  const combinedPath = path.join(exportDir, `${baseName}.md`);
  const outPath = path.join(exportDir, `${baseName}.docx`);

  await writeFile(combinedPath, combined, "utf8");

  const title = String(paperData.title ?? input.paperSlug);

  try {
    const doc = await markdownDocx(
      combined,
      buildMarkdownDocxExportOptions(createDocxImageAdapter(modelRoot)),
    );
    let buffer = await Packer.toBuffer(doc);
    buffer = Buffer.from(await postProcessDocxExport(buffer, outlineComments));
    await writeFile(outPath, buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ModelFsError(`DOCX export failed: ${message}`, 500);
  }

  await patchLastExport(modelRoot, paperRel);

  const fileName = `${baseName}.docx`;
  return {
    path: path.relative(repoRoot, outPath).split(path.sep).join("/"),
    downloadUrl: `/api/export/download?file=${encodeURIComponent(fileName)}`,
    format: "docx",
    ...(missingCitations.length > 0 ? { missingCitations } : {}),
    ...(orphanCrossRefs.length > 0 ? { orphanCrossRefs } : {}),
    ...(title ? { notice: `Exported “${title}” as Word (.docx)` } : {}),
  };
}
