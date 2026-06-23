import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import {
  isEquationDir,
  isFigureDir,
  isTableDir,
  isUnitDir,
  ModelFsError,
  orderedChildren,
  readIndexData,
  resolveChildPath,
} from "./modelFs.js";

const PROPAGATION_SKIP = new Set(["notes", ".sessions", ".trash", "figures", "tables", "equations"]);

async function isSectionContainerDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  const kind = String(data.kind ?? "");
  return kind === "section" || kind === "paper";
}

async function allDescendantDraftsApproved(modelRoot: string, sectionRel: string): Promise<boolean> {
  if (!(await isSectionContainerDir(modelRoot, sectionRel))) return true;

  for (const childName of await orderedChildren(modelRoot, sectionRel)) {
    if (PROPAGATION_SKIP.has(childName)) continue;
    const childRel = resolveChildPath(modelRoot, sectionRel, childName);
    if (!childRel) continue;

    if (await isSectionContainerDir(modelRoot, childRel)) {
      if (!(await allDescendantDraftsApproved(modelRoot, childRel))) return false;
      const nestedDraftAbs = path.join(modelRoot, childRel, "draft.md");
      if (existsSync(nestedDraftAbs) && !(await draftsMatchApproved(modelRoot, childRel))) {
        return false;
      }
      continue;
    }

    if (
      (await isUnitDir(modelRoot, childRel)) ||
      (await isFigureDir(modelRoot, childRel)) ||
      (await isTableDir(modelRoot, childRel)) ||
      (await isEquationDir(modelRoot, childRel))
    ) {
      const childDraftAbs = path.join(modelRoot, childRel, "draft.md");
      if (existsSync(childDraftAbs) && !(await draftsMatchApproved(modelRoot, childRel))) {
        return false;
      }
    }
  }

  return true;
}

async function allDescendantOutlinesApproved(modelRoot: string, sectionRel: string): Promise<boolean> {
  if (!(await isSectionContainerDir(modelRoot, sectionRel))) return true;

  for (const childName of await orderedChildren(modelRoot, sectionRel)) {
    if (PROPAGATION_SKIP.has(childName)) continue;
    const childRel = resolveChildPath(modelRoot, sectionRel, childName);
    if (!childRel) continue;

    if (await isSectionContainerDir(modelRoot, childRel)) {
      if (!(await allDescendantOutlinesApproved(modelRoot, childRel))) return false;
      const nestedOutlineAbs = path.join(modelRoot, childRel, "outline.md");
      if (existsSync(nestedOutlineAbs) && !(await outlinesMatchApproved(modelRoot, childRel))) {
        return false;
      }
      continue;
    }

    if (
      (await isUnitDir(modelRoot, childRel)) ||
      (await isFigureDir(modelRoot, childRel)) ||
      (await isTableDir(modelRoot, childRel)) ||
      (await isEquationDir(modelRoot, childRel))
    ) {
      const childOutlineAbs = path.join(modelRoot, childRel, "outline.md");
      if (existsSync(childOutlineAbs) && !(await outlinesMatchApproved(modelRoot, childRel))) {
        return false;
      }
    }
  }

  return true;
}

export const DRAFT_APPROVED_DOC = "draft.approved.md";
export const OUTLINE_APPROVED_DOC = "outline.approved.md";

export type DraftEditMeta = {
  editedBy: string | null;
  editedAt: string | null;
  aiAssisted: boolean;
  aiProvider: string | null;
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

export function isOutlineFilePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized.endsWith("/outline.md") || normalized === "outline.md";
}

export function isApprovalTrackedFilePath(relativePath: string): boolean {
  return isDraftFilePath(relativePath) || isOutlineFilePath(relativePath);
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
  if (isDraftFilePath(relativePath)) return unitDirFromDraftFile(relativePath);
  if (isOutlineFilePath(relativePath)) return unitDirFromOutlineFile(relativePath);
  throw new ModelFsError("Not a draft or outline file path", 400);
}

export function approvedDraftRel(unitRel: string): string {
  return `${unitRel}/${DRAFT_APPROVED_DOC}`;
}

export function approvedOutlineRel(unitRel: string): string {
  return `${unitRel}/${OUTLINE_APPROVED_DOC}`;
}

export async function readApprovedDraftContent(modelRoot: string, unitRel: string): Promise<string> {
  const abs = path.join(modelRoot, approvedDraftRel(unitRel));
  if (!existsSync(abs)) return "";
  return readFile(abs, "utf8");
}

export async function readApprovedOutlineContent(modelRoot: string, unitRel: string): Promise<string> {
  const abs = path.join(modelRoot, approvedOutlineRel(unitRel));
  if (!existsSync(abs)) return "";
  return readFile(abs, "utf8");
}

export async function readApprovedContentForFile(
  modelRoot: string,
  fileRel: string,
): Promise<string> {
  const unitRel = unitDirFromApprovalFile(fileRel);
  if (isOutlineFilePath(fileRel)) {
    return readApprovedOutlineContent(modelRoot, unitRel);
  }
  return readApprovedDraftContent(modelRoot, unitRel);
}

export async function readDraftEditMeta(modelRoot: string, unitRel: string): Promise<DraftEditMeta> {
  const indexAbs = path.join(modelRoot, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) {
    return emptyDraftEditMeta();
  }
  const data = await readIndexData(modelRoot, unitRel);
  return {
    editedBy: normalizeGitHubHandle(data.edited_by),
    editedAt: typeof data.edited_at === "string" ? data.edited_at : null,
    aiAssisted: Boolean(data.ai_assisted),
    aiProvider: typeof data.ai_provider === "string" && data.ai_provider.trim() ? data.ai_provider.trim() : null,
    approvedBy: normalizeGitHubHandle(data.approved_by),
    approvedAt: typeof data.approved_at === "string" ? data.approved_at : null,
  };
}

export async function readOutlineEditMeta(modelRoot: string, unitRel: string): Promise<DraftEditMeta> {
  const indexAbs = path.join(modelRoot, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) {
    return emptyDraftEditMeta();
  }
  const data = await readIndexData(modelRoot, unitRel);
  return {
    editedBy: normalizeGitHubHandle(data.outline_edited_by),
    editedAt: typeof data.outline_edited_at === "string" ? data.outline_edited_at : null,
    aiAssisted: Boolean(data.outline_ai_assisted),
    aiProvider:
      typeof data.outline_ai_provider === "string" && data.outline_ai_provider.trim()
        ? data.outline_ai_provider.trim()
        : null,
    approvedBy: normalizeGitHubHandle(data.outline_approved_by),
    approvedAt: typeof data.outline_approved_at === "string" ? data.outline_approved_at : null,
  };
}

export async function readEditMetaForFile(
  modelRoot: string,
  fileRel: string,
): Promise<DraftEditMeta> {
  const unitRel = unitDirFromApprovalFile(fileRel);
  if (isOutlineFilePath(fileRel)) {
    return readOutlineEditMeta(modelRoot, unitRel);
  }
  return readDraftEditMeta(modelRoot, unitRel);
}

function emptyDraftEditMeta(): DraftEditMeta {
  return {
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    approvedBy: null,
    approvedAt: null,
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

export async function outlinesMatchApproved(modelRoot: string, unitRel: string): Promise<boolean> {
  const outlineAbs = path.join(modelRoot, unitRel, "outline.md");
  if (!existsSync(outlineAbs)) return true;
  const approvedAbs = path.join(modelRoot, approvedOutlineRel(unitRel));
  if (!existsSync(approvedAbs)) return false;
  const [outline, approved] = await Promise.all([
    readFile(outlineAbs, "utf8"),
    readFile(approvedAbs, "utf8"),
  ]);
  return outline === approved;
}

async function isDraftLeafDir(modelRoot: string, unitRel: string): Promise<boolean> {
  return (
    (await isUnitDir(modelRoot, unitRel)) ||
    (await isFigureDir(modelRoot, unitRel)) ||
    (await isTableDir(modelRoot, unitRel)) ||
    (await isEquationDir(modelRoot, unitRel))
  );
}

const PENDING_WALK_SKIP = new Set(["notes", ".sessions", ".trash", "figures", "tables", "equations"]);

/** Paths to draft.md / outline.md that differ from their approved baselines under a paper. */
export async function collectPendingApprovalPaths(
  modelRoot: string,
  rootRel: string,
): Promise<string[]> {
  const paths: string[] = [];
  const draftLeafCache = new Map<string, boolean>();

  async function isDraftLeafCached(dirRel: string): Promise<boolean> {
    const cached = draftLeafCache.get(dirRel);
    if (cached !== undefined) return cached;
    const value = await isDraftLeafDir(modelRoot, dirRel);
    draftLeafCache.set(dirRel, value);
    return value;
  }

  async function walk(dirRel: string): Promise<void> {
    if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) return;
    const base = path.posix.basename(dirRel);
    if (PENDING_WALK_SKIP.has(base)) return;
    if (!existsSync(path.join(modelRoot, dirRel))) return;

    if (existsSync(path.join(modelRoot, dirRel, "draft.md")) && !(await draftsMatchApproved(modelRoot, dirRel))) {
      paths.push(`${dirRel}/draft.md`);
    }
    if (
      existsSync(path.join(modelRoot, dirRel, "outline.md")) &&
      !(await outlinesMatchApproved(modelRoot, dirRel))
    ) {
      paths.push(`${dirRel}/outline.md`);
    }

    if (await isDraftLeafCached(dirRel)) return;

    for (const child of await orderedChildren(modelRoot, dirRel)) {
      if (PENDING_WALK_SKIP.has(child)) continue;
      const childRel = resolveChildPath(modelRoot, dirRel, child);
      if (!childRel) continue;
      await walk(childRel);
    }
  }

  await walk(rootRel);
  return paths;
}

/** Most recent AI provider name among pending draft edits under a section/paper path. */
export async function findPendingAiProviderUnder(
  modelRoot: string,
  rootRel: string,
): Promise<string | null> {
  let best: { provider: string; at: number } | null = null;
  const paths = await collectPendingApprovalPaths(modelRoot, rootRel);
  for (const fileRel of paths) {
    if (!isDraftFilePath(fileRel)) continue;
    const unitRel = unitDirFromDraftFile(fileRel);
    const meta = await readDraftEditMeta(modelRoot, unitRel);
    if (!meta.aiAssisted || !meta.aiProvider) continue;
    const at = meta.editedAt ? Date.parse(meta.editedAt) : 0;
    if (!best || at >= best.at) {
      best = { provider: meta.aiProvider, at };
    }
  }
  return best?.provider ?? null;
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
  if (kind !== "unit" && kind !== "figure" && kind !== "table" && kind !== "equation") return null;
  await writeFile(indexAbs, matter.stringify(parsed.content, { ...data, ...patch }), "utf8");
  return `${unitRel}/INDEX.md`;
}

export type DraftSaveMeta = {
  editedBy?: string | null;
  aiAssisted?: boolean;
  aiProvider?: string | null;
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
  if (meta?.aiProvider !== undefined) {
    patch.ai_provider = meta.aiProvider;
  }

  const indexPath = await patchLeafIndex(modelRoot, unitRel, patch);
  return indexPath ? [indexPath] : [];
}

/** Mark a unit drafted after AI wrote draft.md outside the file-save API. */
export async function markDraftAiAssisted(
  modelRoot: string,
  unitRel: string,
  editedBy?: string | null,
  aiProvider?: string | null,
): Promise<string[]> {
  return markDraftUnapproved(modelRoot, unitRel, {
    editedBy: editedBy ?? null,
    aiAssisted: true,
    aiProvider: aiProvider ?? null,
  });
}

/** After outline.md diverges from outline.approved.md, record outline edit metadata. */
export async function markOutlineUnapproved(
  modelRoot: string,
  unitRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  if (!(await isDraftLeafDir(modelRoot, unitRel))) return [];
  if (await outlinesMatchApproved(modelRoot, unitRel)) return [];

  const patch: Record<string, unknown> = {
    outline_edited_at: new Date().toISOString(),
  };
  if (meta?.editedBy !== undefined) {
    patch.outline_edited_by = meta.editedBy;
  }
  if (meta?.aiAssisted !== undefined) {
    patch.outline_ai_assisted = meta.aiAssisted;
  }
  if (meta?.aiProvider !== undefined) {
    patch.outline_ai_provider = meta.aiProvider;
  }

  const indexPath = await patchLeafIndex(modelRoot, unitRel, patch);
  return indexPath ? [indexPath] : [];
}

/** Mark outline pending approval after AI wrote outline.md outside the file-save API. */
export async function markOutlineAiAssisted(
  modelRoot: string,
  unitRel: string,
  editedBy?: string | null,
  aiProvider?: string | null,
): Promise<string[]> {
  return markOutlineUnapproved(modelRoot, unitRel, {
    editedBy: editedBy ?? null,
    aiAssisted: true,
    aiProvider: aiProvider ?? null,
  });
}

async function propagateDraftApprovalToAncestors(
  modelRoot: string,
  unitRel: string,
  approvedBy?: string | null,
): Promise<string[]> {
  const updated: string[] = [];
  let sectionRel = path.posix.dirname(unitRel);

  while (sectionRel && sectionRel !== ".") {
    const indexAbs = path.join(modelRoot, sectionRel, "INDEX.md");
    if (!existsSync(indexAbs)) break;

    if (await allDescendantDraftsApproved(modelRoot, sectionRel)) {
      const draftRel = `${sectionRel}/draft.md`;
      if (existsSync(path.join(modelRoot, draftRel))) {
        updated.push(...(await approveDraftFile(modelRoot, draftRel, approvedBy, { skipPropagate: true })));
      }
    }

    sectionRel = path.posix.dirname(sectionRel);
  }

  return updated;
}

async function propagateOutlineApprovalToAncestors(
  modelRoot: string,
  unitRel: string,
  approvedBy?: string | null,
): Promise<string[]> {
  const updated: string[] = [];
  let sectionRel = path.posix.dirname(unitRel);

  while (sectionRel && sectionRel !== ".") {
    const indexAbs = path.join(modelRoot, sectionRel, "INDEX.md");
    if (!existsSync(indexAbs)) break;

    if (await allDescendantOutlinesApproved(modelRoot, sectionRel)) {
      const outlineRel = `${sectionRel}/outline.md`;
      if (existsSync(path.join(modelRoot, outlineRel))) {
        updated.push(...(await approveOutlineFile(modelRoot, outlineRel, approvedBy, { skipPropagate: true })));
      }
    }

    sectionRel = path.posix.dirname(sectionRel);
  }

  return updated;
}

async function approveDraftFile(
  modelRoot: string,
  draftRel: string,
  approvedBy?: string | null,
  options?: { skipPropagate?: boolean },
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
  if (!options?.skipPropagate) {
    updated.push(...(await propagateDraftApprovalToAncestors(modelRoot, unitRel, approvedBy)));
  }
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
    ai_provider: null,
  });
  if (indexPath) updated.push(indexPath);
  return updated;
}

async function approveOutlineFile(
  modelRoot: string,
  outlineRel: string,
  approvedBy?: string | null,
  options?: { skipPropagate?: boolean },
): Promise<string[]> {
  const unitRel = unitDirFromOutlineFile(outlineRel);
  const outlineAbs = path.join(modelRoot, outlineRel);
  if (!existsSync(outlineAbs)) {
    throw new ModelFsError(`Not found: ${outlineRel}`, 404);
  }
  const content = await readFile(outlineAbs, "utf8");
  const approvedRel = approvedOutlineRel(unitRel);
  await mkdir(path.dirname(path.join(modelRoot, approvedRel)), { recursive: true });
  await writeFile(path.join(modelRoot, approvedRel), content, "utf8");
  const updated = [outlineRel, approvedRel];
  const patch: Record<string, unknown> = {
    outline_approved_at: new Date().toISOString(),
  };
  if (approvedBy) {
    patch.outline_approved_by = approvedBy;
  }
  const indexPath = await patchLeafIndex(modelRoot, unitRel, patch);
  if (indexPath) updated.push(indexPath);
  if (!options?.skipPropagate) {
    updated.push(...(await propagateOutlineApprovalToAncestors(modelRoot, unitRel, approvedBy)));
  }
  return updated;
}

async function discardOutlineFile(modelRoot: string, outlineRel: string): Promise<string[]> {
  const unitRel = unitDirFromOutlineFile(outlineRel);
  const approvedRel = approvedOutlineRel(unitRel);
  const approvedAbs = path.join(modelRoot, approvedRel);
  if (!existsSync(approvedAbs)) {
    throw new ModelFsError("No approved outline to restore", 404);
  }
  const content = await readFile(approvedAbs, "utf8");
  await writeFile(path.join(modelRoot, outlineRel), content, "utf8");
  const updated = [outlineRel];
  const indexPath = await patchLeafIndex(modelRoot, unitRel, {
    outline_edited_by: null,
    outline_edited_at: null,
    outline_ai_assisted: false,
    outline_ai_provider: null,
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

  const children = await orderedChildren(modelRoot, dirRel);
  const ownDraftRel = `${dirRel}/draft.md`;
  if (children.length === 0 && existsSync(path.join(modelRoot, ownDraftRel))) {
    return visit(ownDraftRel);
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

  if (isOutlineFilePath(normalized)) {
    return { updated: await approveOutlineFile(modelRoot, normalized, approvedBy) };
  }

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

  if (isOutlineFilePath(normalized)) {
    return { updated: await discardOutlineFile(modelRoot, normalized) };
  }

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

export async function handleOutlineFileSaved(
  modelRoot: string,
  outlineRel: string,
  meta?: DraftSaveMeta,
): Promise<string[]> {
  const unitRel = unitDirFromOutlineFile(outlineRel);
  return markOutlineUnapproved(modelRoot, unitRel, meta);
}
