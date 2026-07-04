/** CRediT — Contributor Roles Taxonomy (credit.niso.org), the 14 standard roles. */
export const CREDIT_ROLES = [
  "Conceptualization",
  "Data curation",
  "Formal analysis",
  "Funding acquisition",
  "Investigation",
  "Methodology",
  "Project administration",
  "Resources",
  "Software",
  "Supervision",
  "Validation",
  "Visualization",
  "Writing – original draft",
  "Writing – review & editing",
] as const;

export type CreditRole = (typeof CREDIT_ROLES)[number];

/** A structured manuscript author. `affiliations` are 1-based indices into the shared affiliations list. */
export type AuthorEntry = {
  firstName: string;
  middleName?: string;
  lastName: string;
  /** ORCID iD, e.g. "0000-0002-1825-0097". */
  orcid?: string;
  affiliations: number[];
  /** Co-first / equal contribution (dagger marker). */
  equalContribution?: boolean;
  /** Co-corresponding author (asterisk marker). */
  corresponding?: boolean;
  /** Correspondence email (shown when corresponding). */
  email?: string;
  credit?: CreditRole[];
};

/** Full display name from structured parts (single-spaced, order first/middle/last). */
export function authorFullName(author: Pick<AuthorEntry, "firstName" | "middleName" | "lastName">): string {
  return [author.firstName, author.middleName, author.lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Initials + last name, e.g. "I.Y." — used for CRediT statements. */
export function authorInitials(author: Pick<AuthorEntry, "firstName" | "middleName" | "lastName">): string {
  const initials = [author.firstName, author.middleName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join("");
  const last = (author.lastName ?? "").trim();
  return [initials, last].filter(Boolean).join(" ");
}
