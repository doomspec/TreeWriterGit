import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { readIndexData } from "../modelFs.js";
import type { PendingReviewItem } from "@treewriter/shared";

import { summarizeManuscriptChanges } from "./changeSummary.js";
import { readManuscriptEditMeta } from "./meta.js";
import {
  draftsMatchApproved,
  manuscriptFileRel,
  outlinesMatchApproved,
  readApprovedContent,
  type ManuscriptKind,
  unitDirFromManuscriptFile,
} from "./paths.js";
import { collectPendingApprovalPaths } from "./workflow.js";

function titleFromFolderName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function resolveSectionPath(unitRel: string, paperRel: string): string | null {
  if (!unitRel.startsWith(`${paperRel}/`)) return null;
  const rest = unitRel.slice(paperRel.length + 1);
  const firstSegment = rest.split("/").filter(Boolean)[0];
  if (!firstSegment) return paperRel;
  return `${paperRel}/${firstSegment}`;
}

async function readUnitTitle(modelRoot: string, unitRel: string): Promise<string> {
  try {
    const data = await readIndexData(modelRoot, unitRel);
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (title) return title;
  } catch {
    // fall through
  }
  return titleFromFolderName(path.posix.basename(unitRel));
}

async function buildPendingReviewItem(
  modelRoot: string,
  fileRel: string,
  paperRel: string,
  kind: ManuscriptKind,
): Promise<PendingReviewItem> {
  const unitRel = unitDirFromManuscriptFile(fileRel, kind);
  const [meta, unitTitle, approved, current] = await Promise.all([
    readManuscriptEditMeta(modelRoot, unitRel, kind),
    readUnitTitle(modelRoot, unitRel),
    readApprovedContent(modelRoot, unitRel, kind),
    readFile(path.join(modelRoot, fileRel), "utf8"),
  ]);

  return {
    path: fileRel,
    kind,
    unitPath: unitRel,
    unitTitle,
    sectionPath: resolveSectionPath(unitRel, paperRel),
    editedBy: meta.editedBy,
    editedAt: meta.editedAt,
    aiAssisted: meta.aiAssisted,
    aiProvider: meta.aiProvider,
    changeSummary: summarizeManuscriptChanges(approved, current),
  };
}

/** Rich pending review rows for a paper, with author/AI metadata and diff stats. */
export async function collectPendingReviewItems(
  modelRoot: string,
  paperRel: string,
): Promise<PendingReviewItem[]> {
  const paths = await collectPendingApprovalPaths(modelRoot, paperRel);
  const items: PendingReviewItem[] = [];

  for (const fileRel of paths) {
    const kind: ManuscriptKind = fileRel.endsWith("/outline.md") ? "outline" : "draft";
    items.push(await buildPendingReviewItem(modelRoot, fileRel, paperRel, kind));
  }

  items.sort((a, b) => {
    const aTime = a.editedAt ? Date.parse(a.editedAt) : 0;
    const bTime = b.editedAt ? Date.parse(b.editedAt) : 0;
    return bTime - aTime;
  });

  return items;
}

/** Quick check used by tests — same walk as collectPendingApprovalPaths but returns items inline. */
export async function isManuscriptPending(
  modelRoot: string,
  unitRel: string,
  kind: ManuscriptKind,
): Promise<boolean> {
  const fileRel = manuscriptFileRel(unitRel, kind);
  if (!existsSync(path.join(modelRoot, fileRel))) return false;
  return kind === "draft"
    ? !(await draftsMatchApproved(modelRoot, unitRel))
    : !(await outlinesMatchApproved(modelRoot, unitRel));
}
