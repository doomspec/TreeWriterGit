export {
  DRAFT_APPROVED_DOC,
  OUTLINE_APPROVED_DOC,
  approvedDraftRel,
  approvedOutlineRel,
  draftsMatchApproved,
  isApprovalTrackedFilePath,
  isChildApprovalFilePath,
  isDraftFilePath,
  isOutlineFilePath,
  outlinesMatchApproved,
  readApprovedContentForFile,
  readApprovedDraftContent,
  readApprovedOutlineContent,
  unitDirFromApprovalFile,
  unitDirFromDraftFile,
  unitDirFromOutlineFile,
} from "./paths.js";

export type { DraftEditMeta, DraftSaveMeta } from "./meta.js";
export {
  handleDraftFileSaved,
  handleOutlineFileSaved,
  markDraftAiAssisted,
  markDraftUnapproved,
  markOutlineAiAssisted,
  markOutlineUnapproved,
  normalizeGitHubHandle,
  readDraftEditMeta,
  readEditMetaForFile,
  readOutlineEditMeta,
} from "./meta.js";

export {
  approveDraftTarget,
  approvePendingChildrenTarget,
  collectPendingApprovalPaths,
  discardDraftTarget,
  findPendingAiProviderUnder,
} from "./workflow.js";
