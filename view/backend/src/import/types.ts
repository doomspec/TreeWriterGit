export type DocxImportOptions = {
  approvedBy?: string | null;
  autoApprove?: boolean;
  /** Import under `papers/{slug}/{targetSection}` instead of the paper root. */
  targetSection?: string | null;
  /** Remove existing children of the import parent before importing (default: true). */
  replaceTarget?: boolean;
  /** User-edited structure from the import preview dialog (skips markdown structure parse). */
  importPlan?: import("./plan.js").DocxImportPreviewNode[] | null;
};

export type DocxImportResult = {
  sectionsCreated: number;
  unitsCreated: number;
  paths: string[];
  paperTitle?: string;
  notice?: string;
};

export type DocxImportPreviewNode = {
  title: string;
  slug: string;
  kind: "section" | "subsection" | "unit";
  body?: string;
  children?: DocxImportPreviewNode[];
};

export type DocxImportTargetOption = {
  slug: string;
  path: string;
  title: string;
  existingNodeCount: number;
};

export type DocxImportPreview = {
  importTargetPath: string;
  importTargetSlug: string;
  importTargetTitle: string;
  replaceExisting: boolean;
  importedPaperTitle?: string;
  existing: DocxImportPreviewNode[];
  imported: DocxImportPreviewNode[];
  sectionsCreated: number;
  unitsCreated: number;
  availableTargets: DocxImportTargetOption[];
};
