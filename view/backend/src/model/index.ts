export {
  ModelFsError,
  PAPER_ASSET_DIRS,
  TEMP_NOTES_DOC,
} from "./errors.js";
export type { NodeKind } from "./errors.js";

export {
  resolveModelPath,
  toRelative,
  shellQuote,
  resolveManuscriptSectionsRoot,
  resolveChildPath,
  isNotesContainerRel,
} from "./paths.js";

export {
  readIndexData,
  orderedChildren,
  patchNodeOrder,
  reorderChildren,
} from "./ordering.js";

export {
  isTableDir,
  isEquationDir,
  isFigureDir,
  isUnitDir,
  classifyManuscriptNode,
  type ManuscriptLeafKind,
  type ManuscriptNodeKind,
} from "./kinds.js";

export { isManuscriptRoot, docTypeFromIndex } from "./manuscriptKind.js";

export {
  walkManuscript,
  walkManuscriptLeaves,
  type ManuscriptWalkContext,
  type ManuscriptWalkOptions,
  type ManuscriptWalkVisitor,
} from "./walk.js";

export {
  indexSkeleton,
  outlineDocSkeleton,
  tempNotesDocSkeleton,
  materializeOutline,
  materializeDraft,
  materializeTempNotes,
} from "./materialize.js";

export {
  createFile,
  createNode,
  deleteNode,
  moveNode,
} from "./crud.js";
