import type { AuthorEntry } from "./credit.js";
import { authorFullName } from "./credit.js";

/** Identity + affiliation strings — no per-paper CRediT or authorship markers. */
export type RegistryAuthor = {
  firstName: string;
  middleName?: string;
  lastName: string;
  orcid?: string;
  email?: string;
  affiliationTexts: string[];
};

export type ContributorsRegistry = {
  affiliations: string[];
  authors: RegistryAuthor[];
};

export type ContributorsRegistryResponse = { registry: ContributorsRegistry };

export function normalizeAffiliationLabel(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function authorRegistryKey(author: Pick<AuthorEntry | RegistryAuthor, "firstName" | "middleName" | "lastName" | "orcid">): string | null {
  const orcid = (author.orcid ?? "").trim();
  if (orcid) return `orcid:${orcid.toLowerCase()}`;
  const firstName = (author.firstName ?? "").trim().toLowerCase();
  const middleName = (author.middleName ?? "").trim().toLowerCase();
  const lastName = (author.lastName ?? "").trim().toLowerCase();
  if (!firstName && !middleName && !lastName) return null;
  return `name:${firstName}|${middleName}|${lastName}`;
}

function affiliationKey(text: string): string {
  return affiliationMatchKey(text);
}

export function affiliationMatchKey(text: string): string {
  return normalizeAffiliationLabel(text).toLowerCase();
}

function authorAffiliationTexts(author: AuthorEntry, affiliations: string[]): string[] {
  return author.affiliations
    .map((index) => affiliations[index - 1] ?? "")
    .map(normalizeAffiliationLabel)
    .filter(Boolean);
}

function toRegistryAuthor(author: AuthorEntry, affiliations: string[]): RegistryAuthor | null {
  const key = authorRegistryKey(author);
  if (!key) return null;
  const entry: RegistryAuthor = {
    firstName: author.firstName.trim(),
    lastName: author.lastName.trim(),
    affiliationTexts: authorAffiliationTexts(author, affiliations),
  };
  const middleName = (author.middleName ?? "").trim();
  if (middleName) entry.middleName = middleName;
  const orcid = (author.orcid ?? "").trim();
  if (orcid) entry.orcid = orcid;
  const email = (author.email ?? "").trim();
  if (email) entry.email = email;
  return entry;
}

function mergeRegistryAuthor(existing: RegistryAuthor, incoming: RegistryAuthor): RegistryAuthor {
  const affiliationTexts = [...existing.affiliationTexts];
  for (const text of incoming.affiliationTexts) {
    const normalized = normalizeAffiliationLabel(text);
    if (!normalized) continue;
    if (!affiliationTexts.some((item) => affiliationKey(item) === affiliationKey(normalized))) {
      affiliationTexts.push(normalized);
    }
  }
  return {
    firstName: incoming.firstName || existing.firstName,
    middleName: incoming.middleName || existing.middleName,
    lastName: incoming.lastName || existing.lastName,
    orcid: incoming.orcid || existing.orcid,
    email: incoming.email || existing.email,
    affiliationTexts,
  };
}

/** Merge manuscript authors/affiliations into the global registry (deduped). */
export function mergeContributorsRegistry(
  registry: ContributorsRegistry,
  authors: AuthorEntry[],
  affiliations: string[],
): ContributorsRegistry {
  const nextAffiliations = [...registry.affiliations];
  const affiliationIndex = new Map(nextAffiliations.map((text, index) => [affiliationKey(text), index]));

  const addAffiliation = (text: string) => {
    const normalized = normalizeAffiliationLabel(text);
    if (!normalized) return;
    const key = affiliationKey(normalized);
    if (!affiliationIndex.has(key)) {
      affiliationIndex.set(key, nextAffiliations.length);
      nextAffiliations.push(normalized);
    }
  };

  for (const text of affiliations) addAffiliation(text);
  for (const author of authors) {
    for (const text of authorAffiliationTexts(author, affiliations)) addAffiliation(text);
  }

  const authorMap = new Map(registry.authors.map((author) => [authorRegistryKey(author), author] as const));
  for (const author of authors) {
    const incoming = toRegistryAuthor(author, affiliations);
    if (!incoming) continue;
    const key = authorRegistryKey(incoming);
    if (!key) continue;
    const existing = authorMap.get(key);
    authorMap.set(key, existing ? mergeRegistryAuthor(existing, incoming) : incoming);
  }

  const nextAuthors = [...authorMap.values()].sort((a, b) =>
    authorFullName(a).localeCompare(authorFullName(b)),
  );

  return { affiliations: nextAffiliations, authors: nextAuthors };
}

function ensureAffiliationIndex(text: string, affiliations: string[]): { affiliations: string[]; index: number } {
  const normalized = normalizeAffiliationLabel(text);
  if (!normalized) return { affiliations, index: -1 };
  const existingIndex = affiliations.findIndex((item) => affiliationKey(item) === affiliationKey(normalized));
  if (existingIndex >= 0) return { affiliations, index: existingIndex + 1 };
  return { affiliations: [...affiliations, normalized], index: affiliations.length + 1 };
}

/** Add a registry author to a manuscript, reusing or appending affiliation lines. */
export function importRegistryAuthor(
  registryAuthor: RegistryAuthor,
  authors: AuthorEntry[],
  affiliations: string[],
): { authors: AuthorEntry[]; affiliations: string[] } {
  const key = authorRegistryKey(registryAuthor);
  if (!key) return { authors, affiliations };

  if (authors.some((author) => authorRegistryKey(author) === key)) {
    return { authors, affiliations };
  }

  let nextAffiliations = [...affiliations];
  const affiliationIndices: number[] = [];
  for (const text of registryAuthor.affiliationTexts) {
    const ensured = ensureAffiliationIndex(text, nextAffiliations);
    nextAffiliations = ensured.affiliations;
    if (ensured.index > 0) affiliationIndices.push(ensured.index);
  }

  const entry: AuthorEntry = {
    firstName: registryAuthor.firstName,
    lastName: registryAuthor.lastName,
    affiliations: [...new Set(affiliationIndices)].sort((a, b) => a - b),
  };
  if (registryAuthor.middleName) entry.middleName = registryAuthor.middleName;
  if (registryAuthor.orcid) entry.orcid = registryAuthor.orcid;
  if (registryAuthor.email) entry.email = registryAuthor.email;

  return {
    authors: [...authors, entry],
    affiliations: nextAffiliations,
  };
}

/** Add a registry affiliation line if it is not already on the manuscript. */
export function importRegistryAffiliation(
  affiliationText: string,
  affiliations: string[],
): string[] {
  return ensureAffiliationIndex(affiliationText, affiliations).affiliations;
}

export function emptyContributorsRegistry(): ContributorsRegistry {
  return { affiliations: [], authors: [] };
}
