import type { DocumentType, PaperSummary } from "@/modelApi";

/** Onboarding paper slug — preferred default when opening Manuscripts with no selection. */
export const DEFAULT_GUIDE_PAPER_SLUG = "treewriter-guide";

export function preferDefaultManuscriptSlug(
  papers: PaperSummary[],
  preferredDocType?: DocumentType,
): string | null {
  if (papers.length === 0) return null;
  if (preferredDocType) {
    const typed = papers.find((p) => (p.docType ?? "paper") === preferredDocType);
    if (typed) return typed.slug;
  }
  const guide = papers.find((p) => p.slug === DEFAULT_GUIDE_PAPER_SLUG);
  return guide?.slug ?? papers[0]?.slug ?? null;
}

/** @deprecated Use preferDefaultManuscriptSlug */
export const preferDefaultPaperSlug = preferDefaultManuscriptSlug;

export function defaultManuscriptPath(papers: PaperSummary[], preferredDocType?: DocumentType): string {
  const slug = preferDefaultManuscriptSlug(papers, preferredDocType);
  return slug ? `papers/${slug}` : "papers";
}

/** @deprecated Use defaultManuscriptPath */
export const defaultPaperPath = defaultManuscriptPath;
