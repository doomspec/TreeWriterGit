import type { BibLibraryEntry, ReferenceMetadata } from "@/lib/paperAssets";

export type BibVerificationFilter = "all" | "verified" | "stale" | "unverified";

export function bibEntryHaystack(entry: {
  citeKey: string;
  type?: string;
  fields?: Record<string, string>;
  title?: string;
  authors?: string | null;
  year?: string | null;
  journal?: string | null;
  doi?: string | null;
}): string {
  const fields = entry.fields ?? {};
  return [
    entry.citeKey,
    entry.type,
    fields.title ?? entry.title,
    fields.author ?? fields.authors ?? entry.authors,
    fields.year ?? entry.year,
    fields.journal ?? entry.journal,
    fields.doi ?? entry.doi,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterBibLibraryEntries(
  entries: BibLibraryEntry[],
  query: string,
  status: BibVerificationFilter = "all",
): BibLibraryEntry[] {
  const normalized = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (status !== "all" && entry.verifiedStatus !== status) return false;
    if (!normalized) return true;
    return bibEntryHaystack(entry).includes(normalized);
  });
}

export function filterReferenceMetadata(
  entries: ReferenceMetadata[],
  query: string,
  status: BibVerificationFilter = "all",
): ReferenceMetadata[] {
  const normalized = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (status !== "all" && entry.verifiedStatus !== status) return false;
    if (!normalized) return true;
    return bibEntryHaystack(entry).includes(normalized);
  });
}
