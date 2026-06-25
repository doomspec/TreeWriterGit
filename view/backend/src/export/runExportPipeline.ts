import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { buildInlineNoteLatexPreamble } from "../inlineNotes.js";
import { buildHighlightColorLatexPreamble } from "../exportMarkdown.js";
import {
  buildCombinedExportHeader,
  usesBibtexExportStyle,
  type JournalExportStyle,
} from "../journalExportStyle.js";
import { buildBibliography, findMissingCitations, resolveCslPath } from "./bibliography.js";
import type { ExportValidationConfig } from "@treewriter/shared";
import { ModelFsError } from "../modelFs.js";
import { countUnitsUnder } from "../papers.js";

export type ExportValidationState = {
  orphanCrossRefs: string[];
  missingCitations: string[];
  hasUnapprovedUnits: boolean;
};

export type ExportValidationOptions = Partial<ExportValidationConfig> & {
  /** When true, skip blockOnUnapproved — user opted into draft content. */
  includeDrafts?: boolean;
};

export function assertExportAllowed(
  state: ExportValidationState,
  config: ExportValidationOptions = {},
): void {
  if (config.blockOnOrphanRefs && state.orphanCrossRefs.length > 0) {
    throw new ModelFsError(
      `Export blocked: orphan cross-references (${state.orphanCrossRefs.join(", ")})`,
      422,
    );
  }
  if (config.blockOnMissingCitations && state.missingCitations.length > 0) {
    throw new ModelFsError(
      `Export blocked: missing citations (${state.missingCitations.join(", ")})`,
      422,
    );
  }
  if (config.blockOnUnapproved && state.hasUnapprovedUnits && !config.includeDrafts) {
    throw new ModelFsError("Export blocked: manuscript contains unapproved units", 422);
  }
}

export async function paperHasUnapprovedUnits(
  modelRoot: string,
  paperRel: string,
): Promise<boolean> {
  const counts = await countUnitsUnder(modelRoot, paperRel);
  return counts.total > 0 && counts.approved < counts.total;
}

export type ExportBibliographyBundle = {
  bibliography: string;
  bibPath: string;
  cslPath: string | null;
  missingCitations: string[];
  useBibtexStyle: boolean;
};

/** Shared bibliography + CSL resolution for monolithic and modular exports. */
export async function resolveExportBibliography(
  modelRoot: string,
  paperRel: string,
  combinedMarkdown: string,
  journal: string,
  exportStyle: JournalExportStyle | undefined,
  bundleDir: string,
): Promise<ExportBibliographyBundle> {
  const bibliography = await buildBibliography(modelRoot, paperRel, combinedMarkdown);
  const bibPath = path.join(bundleDir, "references.bib");
  const cslPath = resolveCslPath(modelRoot, journal, exportStyle?.csl);
  const missingCitations = findMissingCitations(combinedMarkdown, bibliography);
  const useBibtexStyle = usesBibtexExportStyle(exportStyle);
  return { bibliography, bibPath, cslPath, missingCitations, useBibtexStyle };
}

/** Shared pandoc header preamble for LaTeX exports. */
export async function resolveExportHeader(
  modelRoot: string,
  notesMarkdown: string,
  exportStyle: JournalExportStyle | undefined,
  extraPreamble?: string,
): Promise<string | undefined> {
  const notesPreamble = buildInlineNoteLatexPreamble(notesMarkdown);
  const highlightPreamble = buildHighlightColorLatexPreamble();
  const inlinePreamble = [notesPreamble, highlightPreamble, extraPreamble].filter(Boolean).join("\n");
  return buildCombinedExportHeader(modelRoot, exportStyle, inlinePreamble || undefined);
}

export async function writeStubFrontmatterFile(
  bundleDir: string,
  paperTitle: string,
  bibliography: string,
  bibPath: string,
): Promise<string> {
  const stubPath = path.join(bundleDir, "stub.md");
  const stubFrontmatter = bibliography.trim()
    ? {
        nocite: "@*\n",
        bibliography: path.basename(bibPath),
        "reference-section": false,
      }
    : undefined;
  await writeFile(stubPath, matter.stringify(`# ${paperTitle}\n`, stubFrontmatter ?? {}), "utf8");
  return stubPath;
}
