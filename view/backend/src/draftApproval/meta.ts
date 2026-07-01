import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import {
  isDraftLeafDir,
  isOutlineFilePath,
  manuscriptMatchesApproved,
  type ManuscriptKind,
  unitDirFromApprovalFile,
  unitDirFromManuscriptFile,
} from "./paths.js";
import {
  approvalMetaToDraftEditMeta,
  buildUnapprovedMetaPatch,
  indexPatchFromApprovalMeta,
  normalizeGitHubHandle,
  readManuscriptApprovalMeta,
  writeApprovalMetaYaml,
} from "./approvalMeta.js";

import type { DraftEditMeta, DraftSaveMeta } from "@treewriter/shared";

export type { DraftEditMeta, DraftSaveMeta };
export { normalizeGitHubHandle };

function emptyDraftEditMeta(): DraftEditMeta {
  return {
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    approvedBy: null,
    approvedAt: null,
    contentHash: null,
    gitCommit: null,
    approvers: [],
  };
}

export async function readManuscriptEditMeta(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
): Promise<DraftEditMeta> {
  const indexAbs = path.join(modelRoot, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) {
    return emptyDraftEditMeta();
  }
  const record = await readManuscriptApprovalMeta(modelRoot, unitRel, kind);
  return approvalMetaToDraftEditMeta(record);
}

export async function readDraftEditMeta(modelRoot: string, unitRel: string): Promise<DraftEditMeta> {
  return readManuscriptEditMeta(modelRoot, unitRel, "draft");
}

export async function readOutlineEditMeta(modelRoot: string, unitRel: string): Promise<DraftEditMeta> {
  return readManuscriptEditMeta(modelRoot, unitRel, "outline");
}

export async function readEditMetaForFile(
  modelRoot: string,
  fileRel: string,
): Promise<DraftEditMeta> {
  const unitRel = unitDirFromApprovalFile(fileRel);
  return readManuscriptEditMeta(
    modelRoot,
    unitRel,
    isOutlineFilePath(fileRel) ? "outline" : "draft",
  );
}

export async function patchLeafIndex(
  modelRoot: string,
  unitRel: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  const indexAbs = path.join(modelRoot, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) return null;
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  const kind = String(data.kind ?? "");
  if (kind !== "unit" && kind !== "figure" && kind !== "table" && kind !== "equation") return null;
  await writeFile(indexAbs, matter.stringify(parsed.content, { ...data, ...patch }), "utf8");
  return `${unitRel}/INDEX.md`;
}

/** After manuscript diverges from approved baseline, record edit metadata. */
export async function markManuscriptUnapproved(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  if (!(await isDraftLeafDir(modelRoot, unitRel))) return [];
  if (await manuscriptMatchesApproved(modelRoot, unitRel, kind)) return [];

  const previous = await readManuscriptApprovalMeta(modelRoot, unitRel, kind);
  const record = buildUnapprovedMetaPatch(kind, previous, meta);
  const updated: string[] = [];
  updated.push(await writeApprovalMetaYaml(modelRoot, unitRel, kind, record));
  const indexPath = await patchLeafIndex(modelRoot, unitRel, indexPatchFromApprovalMeta(kind, record));
  if (indexPath) updated.push(indexPath);
  return updated;
}

export async function markDraftUnapproved(
  modelRoot: string,
  unitRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  return markManuscriptUnapproved(modelRoot, unitRel, "draft", meta);
}

export async function markOutlineUnapproved(
  modelRoot: string,
  unitRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  return markManuscriptUnapproved(modelRoot, unitRel, "outline", meta);
}

async function markManuscriptAiAssisted(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
  editedBy?: string | null,
  aiProvider?: string | null,
): Promise<string[]> {
  return markManuscriptUnapproved(modelRoot, unitRel, kind, {
    editedBy: editedBy ?? null,
    aiAssisted: true,
    aiProvider: aiProvider ?? null,
  });
}

export async function markDraftAiAssisted(
  modelRoot: string,
  unitRel: string,
  editedBy?: string | null,
  aiProvider?: string | null,
): Promise<string[]> {
  return markManuscriptAiAssisted(modelRoot, unitRel, "draft", editedBy, aiProvider);
}

export async function markOutlineAiAssisted(
  modelRoot: string,
  unitRel: string,
  editedBy?: string | null,
  aiProvider?: string | null,
): Promise<string[]> {
  return markManuscriptAiAssisted(modelRoot, unitRel, "outline", editedBy, aiProvider);
}

export async function handleManuscriptFileSaved(
  modelRoot: string,
  fileRel: string,
  kind: ManuscriptKind,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  const unitRel = unitDirFromManuscriptFile(fileRel, kind);
  return markManuscriptUnapproved(modelRoot, unitRel, kind, meta);
}

export async function handleDraftFileSaved(
  modelRoot: string,
  draftRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  return handleManuscriptFileSaved(modelRoot, draftRel, "draft", meta);
}

export async function handleOutlineFileSaved(
  modelRoot: string,
  outlineRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  return handleManuscriptFileSaved(modelRoot, outlineRel, "outline", meta);
}
