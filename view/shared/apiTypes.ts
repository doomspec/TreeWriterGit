/** Shared API contracts — keep frontend and backend in sync. */

export type DocumentType = "paper" | "grant" | "report";

export type ContributionMode = "kernel" | "repository";

export type ExportPrimaryFormat = "latex" | "docx" | "pdf";

export type ManuscriptTemplate = {
  templateId: string;
  docType: DocumentType;
  label: string;
  description: string;
  journal?: string;
  targetWords: number;
  targetPages?: number;
  sectionOrder: string[];
  statusOptions: string[];
  assetDirs: string[];
  notesDirs: string[];
  requiredFields: string[];
  exportPrimaryFormat: ExportPrimaryFormat;
  /** LaTeX/export styling from template frontmatter (backend-only detail). */
  export?: Record<string, unknown>;
};

/** @deprecated Use ManuscriptTemplate */
export type JournalTemplate = ManuscriptTemplate & { journal: string };

export type UnitStatusCounts = {
  approved: number;
  drafted: number;
  outline: number;
  total: number;
};

export type ManuscriptSummary = {
  slug: string;
  path: string;
  title: string;
  docType: DocumentType;
  journal: string;
  status: string;
  lastExport: string | null;
  tags: string[];
  project: string | null;
  counts: UnitStatusCounts;
};

/** @deprecated Use ManuscriptSummary */
export type PaperSummary = ManuscriptSummary;

export type SectionRollup = {
  path: string;
  title: string;
  counts: UnitStatusCounts;
};

export type PendingReviewChangeSummary = {
  addedLines: number;
  removedLines: number;
  changedWords: number;
};

export type PendingReviewItem = {
  path: string;
  kind: "draft" | "outline";
  unitPath: string;
  unitTitle: string;
  sectionPath: string | null;
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  aiProvider: string | null;
  changeSummary: PendingReviewChangeSummary;
};

export type ManuscriptDetail = ManuscriptSummary & {
  templateId: string | null;
  authors: string[];
  /** Affiliation lines, in order; numbered by position (1-based) in the LaTeX title block. */
  affiliations: string[];
  /** Parallel to `authors`: each author's 1-based affiliation indices (empty = no superscript). */
  authorAffiliations: number[][];
  targetWords: number;
  sectionOrder: string[];
  overleafRepoPath: string | null;
  overleafGitUrl: string | null;
  funder: string | null;
  program: string | null;
  deadline: string | null;
  audience: string | null;
  contributionMode: ContributionMode | null;
  agentSummary: string | null;
  sections: SectionRollup[];
  containerCounts: Record<string, UnitStatusCounts>;
  pendingApprovalPaths: string[];
  pendingReviews: PendingReviewItem[];
};

/** @deprecated Use ManuscriptDetail */
export type PaperDetail = ManuscriptDetail;

export type DraftEditMeta = {
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  aiProvider: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  contentHash?: string | null;
  gitCommit?: string | null;
  approvers?: string[];
};

export type DraftSaveMeta = {
  editedBy?: string | null;
  aiAssisted?: boolean;
  aiProvider?: string | null;
};

export type ModelEventKind = "structure" | "content" | "comments";

export type ModelEvent = {
  type: string;
  path?: string;
  kind?: ModelEventKind;
  treeVersion?: number;
};

export type ExportFormat = "latex" | "pdf" | "docx";

/** Subset of export settings used to gate export / Overleaf push. */
export type ExportValidationConfig = {
  /** Refuse export when cross-refs point to missing figures/tables/equations. */
  blockOnOrphanRefs: boolean;
  /** Refuse export when the paper has units not yet approved. */
  blockOnUnapproved: boolean;
  /** Refuse export when cited keys are missing from the bibliography. */
  blockOnMissingCitations: boolean;
};

export type ExportPaperResult = {
  path: string;
  downloadUrl: string;
  format: ExportFormat;
  notice?: string;
  missingCitations?: string[];
  orphanCrossRefs?: string[];
  cslPath?: string;
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
  /** Unit draft text shown in the import preview editor. */
  body?: string;
  children?: DocxImportPreviewNode[];
};

export type DocxImportTargetOption = {
  /** Empty string selects the paper root. */
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

export type CommentAssigneeType = "human" | "ai";

export type CommentAssignee = {
  type: CommentAssigneeType;
  /** GitHub handle or AI provider name */
  id: string;
  label: string;
};

export type CommentRecord = {
  id: string;
  file: string;
  line: number;
  author: string;
  text: string;
  resolved: boolean;
  created_at: string;
  updated_at?: string;
  assigned_to?: CommentAssignee | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
};

export type CommentSummary = {
  unresolved: number;
  total: number;
  assigned: number;
  assignedUnresolved: number;
};

export type GitSyncState = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastOutput?: string | null;
  conflictDetected?: boolean;
  pendingStashRestore?: boolean;
  viewChangesBlocked?: boolean;
  autoSync?: boolean;
  intervalMs?: number;
};

export type OverleafStatus = {
  connected: boolean;
  gitUrl: string | null;
  repoPath: string | null;
  projectId: string | null;
};

export type OverleafPushResult = {
  repoPath: string;
  committed: boolean;
  message: string;
  exportPath: string;
  missingCitations?: string[];
  orphanCrossRefs?: string[];
};

export type PresenceEntry = {
  user: string;
  file: string;
  since: string;
};

export type AgentJobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type AgentJobRecord = {
  id: string;
  unitPath: string;
  providerName: string;
  state: AgentJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  outputHash: string | null;
};

export type AgentProvidersResponse = {
  aiProviders: Array<{
    name: string;
    command: string;
    args: string[];
    writesFiles: boolean;
  }>;
  defaultProvider: string;
};
