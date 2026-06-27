import { replaceServerDraftPendingPaths } from "@/lib/draftPendingStore";
import { fetchPaperDetail } from "@/modelApi";

export function paperSlugFromSectionPath(sectionPath: string): string | null {
  const match = sectionPath.match(/^papers\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Reload server-scanned pending draft/outline paths for a paper. */
export async function refreshPaperPendingPaths(sectionPath: string): Promise<void> {
  const slug = paperSlugFromSectionPath(sectionPath);
  if (!slug) return;
  try {
    const data = await fetchPaperDetail(slug);
    replaceServerDraftPendingPaths(data.paper.pendingApprovalPaths ?? []);
  } catch {
    replaceServerDraftPendingPaths([]);
  }
}
