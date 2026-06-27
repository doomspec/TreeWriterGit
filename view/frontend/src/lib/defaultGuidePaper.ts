import type { PaperSummary } from "@/modelApi";

/** Onboarding paper slug — preferred default when opening Papers with no selection. */
export const DEFAULT_GUIDE_PAPER_SLUG = "treewriter-guide";

export function preferDefaultPaperSlug(papers: PaperSummary[]): string | null {
  if (papers.length === 0) return null;
  const guide = papers.find((p) => p.slug === DEFAULT_GUIDE_PAPER_SLUG);
  return guide?.slug ?? papers[0]?.slug ?? null;
}

export function defaultPaperPath(papers: PaperSummary[]): string {
  const slug = preferDefaultPaperSlug(papers);
  return slug ? `papers/${slug}` : "papers";
}
