/** Lightweight client-side BibTeX entry validation (advisory, not a full BibTeX grammar check). */

const VENUE_FIELDS_BY_TYPE: Record<string, string[]> = {
  article: ["journal"],
  inproceedings: ["booktitle"],
  incollection: ["booktitle"],
  book: ["publisher"],
  phdthesis: ["school"],
  mastersthesis: ["school"],
  techreport: ["institution"],
};

function isBlank(value: string | undefined): boolean {
  return !value || !value.trim();
}

/** Returns human-readable warnings; an empty array means no issues found. */
export function validateBibEntryFields(type: string, fields: Record<string, string>): string[] {
  const warnings: string[] = [];
  if (isBlank(fields.title)) warnings.push("Missing title.");
  if (isBlank(fields.author) && isBlank(fields.editor)) warnings.push("Missing author (or editor).");
  if (isBlank(fields.year)) warnings.push("Missing year.");
  else if (!/^\d{4}[a-z]?$/i.test(fields.year.trim())) warnings.push(`Year "${fields.year}" doesn't look like a 4-digit year.`);

  const venueFields = VENUE_FIELDS_BY_TYPE[type.toLowerCase()];
  if (venueFields && !venueFields.some((f) => !isBlank(fields[f]))) {
    warnings.push(`Missing ${venueFields.join(" or ")} for a "${type}" entry.`);
  }

  if (fields.doi && /\s/.test(fields.doi.trim())) warnings.push("DOI contains whitespace.");
  if (fields.url && !/^https?:\/\//i.test(fields.url.trim())) warnings.push("URL doesn't start with http(s)://.");

  return warnings;
}

export function validateCiteKey(citeKey: string): string[] {
  const warnings: string[] = [];
  if (!citeKey.trim()) warnings.push("Cite key is empty.");
  else if (/\s/.test(citeKey)) warnings.push("Cite key contains whitespace.");
  else if (/[{}(),=\\#%~^'"]/.test(citeKey)) warnings.push("Cite key contains characters BibTeX keys should avoid.");
  return warnings;
}
