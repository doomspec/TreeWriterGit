import type { ExportValidationConfig } from "@treewriter/shared";

import { validatePaperCrossRefs } from "./crossRefValidation.js";
import type { ExportValidationOptions, ExportValidationState } from "./export/runExportPipeline.js";
import {
  assertExportAllowed,
  paperHasUnapprovedUnits,
  resolveExportBibliography,
} from "./export/runExportPipeline.js";

export type ExportOrchestratorInput = {
  modelRoot: string;
  paperRel: string;
  combinedMarkdown: string;
  validation: ExportValidationConfig;
  includeDrafts?: boolean;
};

/** Shared validation gate for manual export, batch export, auto-export, and Overleaf push. */
export async function validateExportOrchestrator(
  input: ExportOrchestratorInput,
): Promise<ExportValidationState> {
  const { modelRoot, paperRel, combinedMarkdown, validation, includeDrafts } = input;
  const { orphanCrossRefs } = await validatePaperCrossRefs(modelRoot, paperRel, combinedMarkdown);
  const hasUnapprovedUnits = await paperHasUnapprovedUnits(modelRoot, paperRel);
  const state: ExportValidationState = {
    orphanCrossRefs,
    missingCitations: [],
    hasUnapprovedUnits,
  };
  const options: ExportValidationOptions = { ...validation, includeDrafts };
  assertExportAllowed(state, options);
  return state;
}

export { assertExportAllowed, resolveExportBibliography, validatePaperCrossRefs };
