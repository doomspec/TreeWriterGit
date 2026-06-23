export function parentPath(pathValue: string): string {
  const parts = pathValue.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export const INDEX_DOC = "INDEX.md";
export const OUTLINE_DOC = "outline.md";
export const DRAFT_DOC = "draft.md";
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

export function isHiddenModelFile(fileName: string): boolean {
  return fileName === INDEX_DOC;
}

export function isOutlineDocPath(pathValue: string): boolean {
  return pathValue.endsWith(`/${OUTLINE_DOC}`) || pathValue === OUTLINE_DOC;
}

export function isDraftPath(pathValue: string): boolean {
  return pathValue.endsWith(`/${DRAFT_DOC}`);
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
