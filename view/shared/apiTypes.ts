/** Shared API contracts — keep frontend and backend in sync. */

export type UnitStatusCounts = {
  approved: number;
  drafted: number;
  outline: number;
  total: number;
};

export type PaperSummary = {
  slug: string;
  path: string;
  title: string;
  journal: string;
  status: string;
  lastExport: string | null;
  counts: UnitStatusCounts;
};

export type SectionRollup = {
  path: string;
  title: string;
  counts: UnitStatusCounts;
};

export type PaperDetail = PaperSummary & {
  authors: string[];
  targetWords: number;
  sectionOrder: string[];
  overleafRepoPath: string | null;
  overleafGitUrl: string | null;
  sections: SectionRollup[];
  containerCounts: Record<string, UnitStatusCounts>;
  pendingApprovalPaths: string[];
};

export type DraftEditMeta = {
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  aiProvider: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
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
