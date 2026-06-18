import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import {
  isFigureDir,
  isTableDir,
  isUnitDir,
  ModelFsError,
  orderedChildren,
  readIndexData,
  resolveChildPath,
} from "./modelFs.js";

export const DRAFT_APPROVED_DOC = "draft.approved.md";

export type DraftEditMeta = {
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
};

export function normalizeGitHubHandle(handle: unknown): string | null {
  if (typeof handle !== "string") return null;
  const trimmed = handle.trim().replace(/^@+/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function isDraftFilePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized.endsWith("/draft.md") || normalized === "draft.md";
}

export function unitDirFromDraftFile(relativePath: string): string {
  if (!isDraftFilePath(relativePath)) {
    throw new ModelFsError("Not a draft file path", 400);
  }
  return path.posix.dirname(relativePath.replace(/\\/g, "/"));
}

export function approvedDraftRel(unitRel: string): string {
  return `${unitRel}/${DRAFT_APPROVED_DOC}`;
}

export async function readApprovedDraftContent(modelRoot: string, unitRel: string): Promise<string> {
  const abs = path.join(modelRoot, approvedDraftRel(unitRel));
  if (!existsSync(abs)) return "";
  return readFile(abs, "utf8");
}

export async function readDraftEditMeta(modelRoot: string, unitRel: string): Promise<DraftEditMeta> {
  const indexAbs = path.join(modelRoot, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) {
    return {
      editedBy: null,
      editedAt: null,
      aiAssisted: false,
      approvedBy: null,
      approvedAt: null,
    };
  }
  const data = await readIndexData(modelRoot, unitRel);
  return {
    editedBy: normalizeGitHubHandle(data.edited_by),
    editedAt: typeof data.edited_at === "string" ? data.edited_at : null,
    aiAssisted: Boolean(data.ai_assisted),
    approvedBy: normalizeGitHubHandle(data.approved_by),
    approvedAt: typeof data.approved_at === "string" ? data.approved_at : null,
  };
}

export async function draftsMatchApproved(modelRoot: string, unitRel: string): Promise<boolean> {
  const draftAbs = path.join(modelRoot, unitRel, "draft.md");
  if (!existsSync(draftAbs)) return true;
  const approvedAbs = path.join(modelRoot, approvedDraftRel(unitRel));
  if (!existsSync(approvedAbs)) return false;
  const [draft, approved] = await Promise.all([readFile(draftAbs, "utf8"), readFile(approvedAbs, "utf8")]);
  return draft === approved;
}

async function isDraftLeafDir(modelRoot: string, unitRel: string): Promise<boolean> {
  return (
    (await isUnitDir(modelRoot, unitRel)) ||
    (await isFigureDir(modelRoot, unitRel)) ||
    (await isTableDir(modelRoot, unitRel))
  );
}

async function patchLeafIndex(
  modelRoot: string,
  unitRel: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  const indexAbs = path.join(modelRoot, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) return null;
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  const kind = String(data.kind ?? "");
  if (kind !== "unit" && kind !== "figure" && kind !== "table") return null;
  await writeFile(indexAbs, matter.stringify(parsed.content, { ...data, ...patch }), "utf8");
  return `${unitRel}/INDEX.md`;
}

export type DraftSaveMeta = {
  editedBy?: string | null;
  aiAssisted?: boolean;
};

/** After draft.md is saved, downgrade approval when content diverges from draft.approved.md. */
export async function markDraftUnapproved(
  modelRoot: string,
  unitRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  if (!(await isDraftLeafDir(modelRoot, unitRel))) return [];
  if (await draftsMatchApproved(modelRoot, unitRel)) return [];

  const patch: Record<string, unknown> = {
    status: "drafted",
    edited_at: new Date().toISOString(),
  };
  if (meta?.editedBy !== undefined) {
    patch.edited_by = meta.editedBy;
  }
  if (meta?.aiAssisted !== undefined) {
    patch.ai_assisted = meta.aiAssisted;
  }

  const indexPath = await patchLeafIndex(modelRoot, unitRel, patch);
  return indexPath ? [indexPath] : [];
}

/** Mark a unit drafted after AI wrote draft.md outside the file-save API. */
export async function markDraftAiAssisted(
  modelRoot: string,
  unitRel: string,
  editedBy?: string | null,
): Promise<string[]> {
  return markDraftUnapproved(modelRoot, unitRel, {
    editedBy: editedBy ?? null,
    aiAssisted: true,
  });
}

async function approveDraftFile(
  modelRoot: string,
  draftRel: string,
  approvedBy?: string | null,
): Promise<string[]> {
  const unitRel = unitDirFromDraftFile(draftRel);
  const draftAbs = path.join(modelRoot, draftRel);
  if (!existsSync(draftAbs)) {
    throw new ModelFsError(`Not found: ${draftRel}`, 404);
  }
  const content = await readFile(draftAbs, "utf8");
  const approvedRel = approvedDraftRel(unitRel);
  await mkdir(path.dirname(path.join(modelRoot, approvedRel)), { recursive: true });
  await writeFile(path.join(modelRoot, approvedRel), content, "utf8");
  const updated = [draftRel, approvedRel];
  const patch: Record<string, unknown> = {
    status: "approved",
    approved_at: new Date().toISOString(),
  };
  if (approvedBy) {
    patch.approved_by = approvedBy;
  }
  const indexPath = await patchLeafIndex(modelRoot, unitRel, patch);
  if (indexPath) updated.push(indexPath);
  return updated;
}

async function discardDraftFile(modelRoot: string, draftRel: string): Promise<string[]> {
  const unitRel = unitDirFromDraftFile(draftRel);
  const approvedRel = approvedDraftRel(unitRel);
  const approvedAbs = path.join(modelRoot, approvedRel);
  if (!existsSync(approvedAbs)) {
    throw new ModelFsError("No approved draft to restore", 404);
  }
  const content = await readFile(approvedAbs, "utf8");
  await writeFile(path.join(modelRoot, draftRel), content, "utf8");
  const updated = [draftRel];
  const indexPath = await patchLeafIndex(modelRoot, unitRel, {
    status: "approved",
    edited_by: null,
    edited_at: null,
    ai_assisted: false,
  });
  if (indexPath) updated.push(indexPath);
  return updated;
}

async function walkDraftLeaves(
  modelRoot: string,
  dirRel: string,
  visit: (draftRel: string) => Promise<string[]>,
): Promise<string[]> {
  if (await isDraftLeafDir(modelRoot, dirRel)) {
    const draftRel = `${dirRel}/draft.md`;
    if (!existsSync(path.join(modelRoot, draftRel))) return [];
    return visit(draftRel);
  }

  const updated: string[] = [];
  for (const child of await orderedChildren(modelRoot, dirRel)) {
    const childRel = resolveChildPath(modelRoot, dirRel, child);
    if (!childRel) continue;
    updated.push(...(await walkDraftLeaves(modelRoot, childRel, visit)));
  }
  return updated;
}

export async function approveDraftTarget(
  modelRoot: string,
  targetPath: string,
  approvedBy?: string | null,
): Promise<{ updated: string[] }> {
  const normalized = targetPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) throw new ModelFsError("Path required", 400);

  if (isDraftFilePath(normalized)) {
    return { updated: await approveDraftFile(modelRoot, normalized, approvedBy) };
  }

  const updated = await walkDraftLeaves(modelRoot, normalized, (draftRel) =>
    approveDraftFile(modelRoot, draftRel, approvedBy),
  );
  return { updated: [...new Set(updated)] };
}

export async function discardDraftTarget(
  modelRoot: string,
  targetPath: string,
): Promise<{ updated: string[] }> {
  const normalized = targetPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) throw new ModelFsError("Path required", 400);

  if (isDraftFilePath(normalized)) {
    return { updated: await discardDraftFile(modelRoot, normalized) };
  }

  const updated = await walkDraftLeaves(modelRoot, normalized, (draftRel) =>
    discardDraftFile(modelRoot, draftRel),
  );
  return { updated: [...new Set(updated)] };
}

export async function handleDraftFileSaved(
  modelRoot: string,
  draftRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  const unitRel = unitDirFromDraftFile(draftRel);
  return markDraftUnapproved(modelRoot, unitRel, meta);
}
