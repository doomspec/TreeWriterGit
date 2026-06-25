import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  ModelFsError,
  orderedChildren,
  readIndexData,
  resolveChildPath,
} from "../modelFs.js";
import { patchLeafIndex, readDraftEditMeta } from "./meta.js";
import {
  approvedManuscriptRel,
  draftsMatchApproved,
  isApprovalTrackedFilePath,
  isChildApprovalFilePath,
  isDraftFilePath,
  isDraftLeafDir,
  manuscriptKindFromFilePath,
  outlinesMatchApproved,
  type ManuscriptKind,
  unitDirFromDraftFile,
  unitDirFromManuscriptFile,
} from "./paths.js";

const PROPAGATION_SKIP = new Set(["notes", ".sessions", ".trash", "figures", "tables", "equations"]);
const PENDING_WALK_SKIP = PROPAGATION_SKIP;

async function isSectionContainerDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  const kind = String(data.kind ?? "");
  return kind === "section" || kind === "paper";
}

async function allDescendantManuscriptsApproved(
  modelRoot: string,
  sectionRel: string,
  kind: ManuscriptKind,
): Promise<boolean> {
  if (!(await isSectionContainerDir(modelRoot, sectionRel))) return true;
  const matchFn = kind === "draft" ? draftsMatchApproved : outlinesMatchApproved;
  const nestedFileName = kind === "draft" ? "draft.md" : "outline.md";

  for (const childName of await orderedChildren(modelRoot, sectionRel)) {
    if (PROPAGATION_SKIP.has(childName)) continue;
    const childRel = resolveChildPath(modelRoot, sectionRel, childName);
    if (!childRel) continue;

    if (await isSectionContainerDir(modelRoot, childRel)) {
      if (!(await allDescendantManuscriptsApproved(modelRoot, childRel, kind))) return false;
      const nestedAbs = path.join(modelRoot, childRel, nestedFileName);
      if (existsSync(nestedAbs) && !(await matchFn(modelRoot, childRel))) {
        return false;
      }
      continue;
    }

    if (await isDraftLeafDir(modelRoot, childRel)) {
      const childAbs = path.join(modelRoot, childRel, nestedFileName);
      if (existsSync(childAbs) && !(await matchFn(modelRoot, childRel))) {
        return false;
      }
    }
  }

  return true;
}

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

function approvalIndexPatch(kind: ManuscriptKind, approvedBy?: string | null): Record<string, unknown> {
  const prefix = kind === "outline" ? "outline_" : "";
  const patch: Record<string, unknown> = {
    [`${prefix}approved_at`]: new Date().toISOString(),
  };
  if (kind === "draft") {
    patch.status = "approved";
  }
  if (approvedBy) {
    patch[`${prefix}approved_by`] = approvedBy;
  }
  return patch;
}

function discardIndexPatch(kind: ManuscriptKind): Record<string, unknown> {
  const prefix = kind === "outline" ? "outline_" : "";
  const patch: Record<string, unknown> = {
    [`${prefix}edited_by`]: null,
    [`${prefix}edited_at`]: null,
    [`${prefix}ai_assisted`]: false,
    [`${prefix}ai_provider`]: null,
  };
  if (kind === "draft") {
    patch.status = "approved";
  }
  return patch;
}

async function propagateApprovalToAncestors(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
  approvedBy?: string | null,
): Promise<string[]> {
  const updated: string[] = [];
  let sectionRel = path.posix.dirname(unitRel);
  const fileName = kind === "draft" ? "draft.md" : "outline.md";

  while (sectionRel && sectionRel !== ".") {
    const indexAbs = path.join(modelRoot, sectionRel, "INDEX.md");
    if (!existsSync(indexAbs)) break;

    if (await allDescendantManuscriptsApproved(modelRoot, sectionRel, kind)) {
      const manuscriptRel = `${sectionRel}/${fileName}`;
      if (existsSync(path.join(modelRoot, manuscriptRel))) {
        updated.push(
          ...(await approveManuscriptFile(modelRoot, manuscriptRel, approvedBy, { skipPropagate: true })),
        );
      }
    }

    sectionRel = path.posix.dirname(sectionRel);
  }

  return updated;
}

async function approveManuscriptFile(
  modelRoot: string,
  fileRel: string,
  approvedBy?: string | null,
  options?: { skipPropagate?: boolean },
): Promise<string[]> {
  const kind = manuscriptKindFromFilePath(fileRel);
  const unitRel = unitDirFromManuscriptFile(fileRel, kind);
  const manuscriptAbs = path.join(modelRoot, fileRel);
  if (!existsSync(manuscriptAbs)) {
    throw new ModelFsError(`Not found: ${fileRel}`, 404);
  }
  const content = await readFile(manuscriptAbs, "utf8");
  const approvedRel = approvedManuscriptRel(unitRel, kind);
  await mkdir(path.dirname(path.join(modelRoot, approvedRel)), { recursive: true });
  await writeFile(path.join(modelRoot, approvedRel), content, "utf8");
  const updated = [fileRel, approvedRel];
  const indexPath = await patchLeafIndex(modelRoot, unitRel, approvalIndexPatch(kind, approvedBy));
  if (indexPath) updated.push(indexPath);
  if (!options?.skipPropagate) {
    updated.push(...(await propagateApprovalToAncestors(modelRoot, unitRel, kind, approvedBy)));
  }
  return updated;
}

async function discardManuscriptFile(modelRoot: string, fileRel: string): Promise<string[]> {
  const kind = manuscriptKindFromFilePath(fileRel);
  const unitRel = unitDirFromManuscriptFile(fileRel, kind);
  const approvedRel = approvedManuscriptRel(unitRel, kind);
  const approvedAbs = path.join(modelRoot, approvedRel);
  if (!existsSync(approvedAbs)) {
    throw new ModelFsError(`No approved ${kind} to restore`, 404);
  }
  const content = await readFile(approvedAbs, "utf8");
  await writeFile(path.join(modelRoot, fileRel), content, "utf8");
  const updated = [fileRel];
  const indexPath = await patchLeafIndex(modelRoot, unitRel, discardIndexPatch(kind));
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

/** Approve all pending drafts and outlines in child units/subsections (not the section itself). */
export async function approvePendingChildrenTarget(
  modelRoot: string,
  sectionRel: string,
  approvedBy?: string | null,
): Promise<{ updated: string[] }> {
  const normalized = sectionRel.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) throw new ModelFsError("Path required", 400);

  const pending = await collectPendingApprovalPaths(modelRoot, normalized);
  const childPaths = pending.filter((fileRel) => isChildApprovalFilePath(normalized, fileRel));
  const updated: string[] = [];
  for (const fileRel of childPaths) {
    const result = await approveDraftTarget(modelRoot, fileRel, approvedBy);
    updated.push(...result.updated);
  }
  return { updated: [...new Set(updated)] };
}

export async function approveDraftTarget(
  modelRoot: string,
  targetPath: string,
  approvedBy?: string | null,
): Promise<{ updated: string[] }> {
  const normalized = targetPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) throw new ModelFsError("Path required", 400);

  if (isApprovalTrackedFilePath(normalized)) {
    return { updated: await approveManuscriptFile(modelRoot, normalized, approvedBy) };
  }

  const updated = await walkDraftLeaves(modelRoot, normalized, (draftRel) =>
    approveManuscriptFile(modelRoot, draftRel, approvedBy),
  );
  return { updated: [...new Set(updated)] };
}

export async function discardDraftTarget(
  modelRoot: string,
  targetPath: string,
): Promise<{ updated: string[] }> {
  const normalized = targetPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) throw new ModelFsError("Path required", 400);

  if (isApprovalTrackedFilePath(normalized)) {
    return { updated: await discardManuscriptFile(modelRoot, normalized) };
  }

  const updated = await walkDraftLeaves(modelRoot, normalized, (draftRel) =>
    discardManuscriptFile(modelRoot, draftRel),
  );
  return { updated: [...new Set(updated)] };
}
