import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import {
  isEquationDir,
  isFigureDir,
  isTableDir,
  isUnitDir,
  ModelFsError,
} from "../modelFs.js";
import { manuscriptContentHash, normalizeManuscriptForHash } from "./hash.js";
import { readManuscriptApprovalMeta } from "./approvalMeta.js";

export const DRAFT_APPROVED_DOC = "draft.approved.md";
export const OUTLINE_APPROVED_DOC = "outline.approved.md";
export const APPROVAL_DIR = ".approval";
export const TEMP_NOTES_DOC = "temp-notes.md";

export type ManuscriptKind = "draft" | "outline";

export const MANUSCRIPT_KINDS: ManuscriptKind[] = ["draft", "outline"];

export function manuscriptFileName(kind: ManuscriptKind): string {
  return kind === "draft" ? "draft.md" : "outline.md";
}

export function approvedDocName(kind: ManuscriptKind): string {
  return kind === "draft" ? DRAFT_APPROVED_DOC : OUTLINE_APPROVED_DOC;
}

export function approvalDirRel(unitRel: string): string {
  return `${unitRel}/${APPROVAL_DIR}`;
}

export function approvalMetaRel(unitRel: string, kind: ManuscriptKind): string {
  return `${approvalDirRel(unitRel)}/${kind}.yaml`;
}

export function approvedManuscriptRel(unitRel: string, kind: ManuscriptKind): string {
  return `${approvalDirRel(unitRel)}/${approvedDocName(kind)}`;
}

export function legacyApprovedManuscriptRel(unitRel: string, kind: ManuscriptKind): string {
  return `${unitRel}/${approvedDocName(kind)}`;
}

export function resolveApprovedManuscriptRel(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
): string | null {
  const modern = approvedManuscriptRel(unitRel, kind);
  if (existsSync(path.join(modelRoot, modern))) return modern;
  const legacy = legacyApprovedManuscriptRel(unitRel, kind);
  if (existsSync(path.join(modelRoot, legacy))) return legacy;
  return null;
}

export function isDraftFilePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized.endsWith("/draft.md") || normalized === "draft.md";
}

export function isOutlineFilePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized.endsWith("/outline.md") || normalized === "outline.md";
}

export function isTempNotesFilePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized.endsWith(`/${TEMP_NOTES_DOC}`) || normalized === TEMP_NOTES_DOC;
}

export function isApprovalTrackedFilePath(relativePath: string): boolean {
  return isDraftFilePath(relativePath) || isOutlineFilePath(relativePath);
}

export function manuscriptKindFromFilePath(relativePath: string): ManuscriptKind {
  if (isDraftFilePath(relativePath)) return "draft";
  if (isOutlineFilePath(relativePath)) return "outline";
  throw new ModelFsError("Not a draft or outline file path", 400);
}

export function unitDirFromDraftFile(relativePath: string): string {
  if (!isDraftFilePath(relativePath)) {
    throw new ModelFsError("Not a draft file path", 400);
  }
  return path.posix.dirname(relativePath.replace(/\\/g, "/"));
}

export function unitDirFromOutlineFile(relativePath: string): string {
  if (!isOutlineFilePath(relativePath)) {
    throw new ModelFsError("Not an outline file path", 400);
  }
  return path.posix.dirname(relativePath.replace(/\\/g, "/"));
}

export function unitDirFromApprovalFile(relativePath: string): string {
  return manuscriptKindFromFilePath(relativePath) === "draft"
    ? unitDirFromDraftFile(relativePath)
    : unitDirFromOutlineFile(relativePath);
}

export function unitDirFromManuscriptFile(relativePath: string, kind: ManuscriptKind): string {
  return kind === "draft" ? unitDirFromDraftFile(relativePath) : unitDirFromOutlineFile(relativePath);
}

export function approvedDraftRel(unitRel: string): string {
  return approvedManuscriptRel(unitRel, "draft");
}

export function approvedOutlineRel(unitRel: string): string {
  return approvedManuscriptRel(unitRel, "outline");
}

export async function readApprovedContent(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
): Promise<string> {
  const approvedRel = resolveApprovedManuscriptRel(modelRoot, unitRel, kind);
  if (!approvedRel) return "";
  return readFile(path.join(modelRoot, approvedRel), "utf8");
}

export async function readApprovedDraftContent(modelRoot: string, unitRel: string): Promise<string> {
  return readApprovedContent(modelRoot, unitRel, "draft");
}

export async function readApprovedOutlineContent(modelRoot: string, unitRel: string): Promise<string> {
  return readApprovedContent(modelRoot, unitRel, "outline");
}

export async function readApprovedContentForFile(
  modelRoot: string,
  fileRel: string,
): Promise<string> {
  const unitRel = unitDirFromApprovalFile(fileRel);
  return readApprovedContent(modelRoot, unitRel, manuscriptKindFromFilePath(fileRel));
}

export async function manuscriptMatchesApproved(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
): Promise<boolean> {
  const manuscriptAbs = path.join(modelRoot, manuscriptFileRel(unitRel, kind));
  if (!existsSync(manuscriptAbs)) return true;
  const approvedRel = resolveApprovedManuscriptRel(modelRoot, unitRel, kind);
  if (!approvedRel) {
    // Never approved. A brand-new, still-empty/skeleton manuscript has nothing
    // to review yet — don't flag it "pending" (which would let a bulk
    // "approve pending children" sweep bake in an empty snapshot as the
    // approved baseline before the author has written anything).
    const current = await readFile(manuscriptAbs, "utf8");
    return current.trim().length === 0;
  }

  const current = await readFile(manuscriptAbs, "utf8");
  const meta = await readManuscriptApprovalMeta(modelRoot, unitRel, kind);
  if (meta.contentHash) {
    return manuscriptContentHash(current) === meta.contentHash;
  }

  const approved = await readFile(path.join(modelRoot, approvedRel), "utf8");
  return normalizeManuscriptForHash(current) === normalizeManuscriptForHash(approved);
}

export function manuscriptFileRel(unitRel: string, kind: ManuscriptKind): string {
  return `${unitRel}/${manuscriptFileName(kind)}`;
}

export async function draftsMatchApproved(modelRoot: string, unitRel: string): Promise<boolean> {
  return manuscriptMatchesApproved(modelRoot, unitRel, "draft");
}

export async function outlinesMatchApproved(modelRoot: string, unitRel: string): Promise<boolean> {
  return manuscriptMatchesApproved(modelRoot, unitRel, "outline");
}

export async function isDraftLeafDir(modelRoot: string, unitRel: string): Promise<boolean> {
  return (
    (await isUnitDir(modelRoot, unitRel)) ||
    (await isFigureDir(modelRoot, unitRel)) ||
    (await isTableDir(modelRoot, unitRel)) ||
    (await isEquationDir(modelRoot, unitRel))
  );
}

/** True when a pending draft/outline file belongs to a child folder under a section. */
export function isChildApprovalFilePath(sectionRel: string, fileRel: string): boolean {
  const section = sectionRel.replace(/\\/g, "/").replace(/\/+$/, "");
  const file = fileRel.replace(/\\/g, "/");
  if (!section || !file.startsWith(`${section}/`)) return false;
  const remainder = file.slice(section.length + 1);
  return remainder.includes("/");
}
