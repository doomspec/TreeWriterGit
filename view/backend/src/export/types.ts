import type { ExportFormat, ExportPaperResult, ExportValidationConfig } from "@treewriter/shared";

export type { ExportFormat, ExportPaperResult };

export interface ExportPaperInput {
  paperSlug: string;
  format: ExportFormat;
  includeDrafts?: boolean;
  validation?: ExportValidationConfig;
}
