export function parentPath(pathValue: string): string {
  const parts = pathValue.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export const INDEX_DOC = "INDEX.md";
export const OUTLINE_DOC = "outline.md";
export const DRAFT_DOC = "draft.md";
export const TEMP_NOTES_DOC = "temp-notes.md";
export const PAPERS_ROOT = "papers";

export function indexPathFor(directoryPath: string): string {
  return directoryPath ? `${directoryPath}/${INDEX_DOC}` : INDEX_DOC;
}

export function outlinePathFor(directoryPath: string): string {
  return directoryPath ? `${directoryPath}/${OUTLINE_DOC}` : OUTLINE_DOC;
}

export function draftPathFor(directoryPath: string): string {
  return directoryPath ? `${directoryPath}/${DRAFT_DOC}` : DRAFT_DOC;
}

export function tempNotesPathFor(directoryPath: string): string {
  return directoryPath ? `${directoryPath}/${TEMP_NOTES_DOC}` : TEMP_NOTES_DOC;
}

export function isHiddenModelFile(fileName: string): boolean {
  return fileName === INDEX_DOC || fileName === TEMP_NOTES_DOC;
}

export function isOutlineDocPath(pathValue: string): boolean {
  return pathValue.endsWith(`/${OUTLINE_DOC}`) || pathValue === OUTLINE_DOC;
}

export function isDraftPath(pathValue: string): boolean {
  return pathValue.endsWith(`/${DRAFT_DOC}`);
}

export function isManuscriptDocPath(pathValue: string): boolean {
  return isOutlineDocPath(pathValue) || isDraftPath(pathValue);
}

/** Container folder for an outline.md or draft.md file path. */
export function manuscriptContainerPathFromFile(
  filePath: string | null | undefined,
): string | null {
  if (!filePath || !isManuscriptDocPath(filePath)) return null;
  return parentPath(filePath);
}

export function isManuscriptFileForContainer(filePath: string, containerPath: string): boolean {
  return manuscriptContainerPathFromFile(filePath) === containerPath;
}

export function isTempNotesPath(pathValue: string): boolean {
  return pathValue.endsWith(`/${TEMP_NOTES_DOC}`) || pathValue === TEMP_NOTES_DOC;
}

/** @deprecated use isHiddenModelFile */
export function isOutlinePath(pathValue: string): boolean {
  return pathValue === INDEX_DOC || pathValue.endsWith(`/${INDEX_DOC}`);
}

export function isUnderPapers(path: string): boolean {
  return path === PAPERS_ROOT || path.startsWith(`${PAPERS_ROOT}/`);
}

export function isPaperRootPath(pathValue: string): boolean {
  return /^papers\/[^/]+$/.test(pathValue.trim().replace(/\\/g, "/"));
}
