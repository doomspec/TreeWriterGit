/** Backward-compatible facade — import from `./modelFs.js` unchanged. */
export type { NodeKind } from "./model/errors.js";
export {
  ModelFsError,
  PAPER_ASSET_DIRS,
  TEMP_NOTES_DOC,
} from "./model/errors.js";
export {
  resolveModelPath,
  resolvePaperRel,
  toRelative,
  shellQuote,
  resolveManuscriptSectionsRoot,
  resolveChildPath,
  isNotesContainerRel,
} from "./model/paths.js";
export {
  readIndexData,
  orderedChildren,
  patchNodeOrder,
  reorderChildren,
} from "./model/ordering.js";
export {
  isTableDir,
  isEquationDir,
  isFigureDir,
  isUnitDir,
  isManuscriptRoot,
  classifyManuscriptNode,
  walkManuscript,
  walkManuscriptLeaves,
  type ManuscriptLeafKind,
  type ManuscriptNodeKind,
  type ManuscriptWalkContext,
  type ManuscriptWalkOptions,
  type ManuscriptWalkVisitor,
} from "./model/index.js";
export {
  indexSkeleton,
  outlineDocSkeleton,
  tempNotesDocSkeleton,
  materializeOutline,
  materializeDraft,
  materializeTempNotes,
} from "./model/materialize.js";
export {
  createFile,
  createFolder,
  createNode,
  deleteNode,
  moveNode,
} from "./model/crud.js";
