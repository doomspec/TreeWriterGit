import { replaceServerPendingReviews } from "@/lib/draftPendingStore";
import { paperSlugFromModelPath } from "@/lib/activePaperSlug";
import { fetchPaperDetail } from "@/modelApi";

export { paperSlugFromModelPath as paperSlugFromSectionPath } from "@/lib/activePaperSlug";

/** Reload server-scanned pending draft/outline paths for a paper. */
export async function refreshPaperPendingPaths(sectionPath: string): Promise<void> {
  const slug = paperSlugFromModelPath(sectionPath);
  if (!slug) return;
  try {
    const data = await fetchPaperDetail(slug);
    replaceServerPendingReviews(data.paper.pendingReviews ?? []);
  } catch {
    replaceServerPendingReviews([]);
  }
}
