import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import yaml from "js-yaml";

import type { AuthorEntry } from "@treewriter/shared";
import {
  emptyContributorsRegistry,
  mergeContributorsRegistry,
  normalizeAffiliationLabel,
  type ContributorsRegistry,
} from "@treewriter/shared";

export const CONTRIBUTORS_REGISTRY_FILE = "contributors.yaml";

function registryPath(modelRoot: string): string {
  return path.join(modelRoot, CONTRIBUTORS_REGISTRY_FILE);
}

function parseRegistry(raw: string): ContributorsRegistry {
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== "object") return emptyContributorsRegistry();
  const record = parsed as Record<string, unknown>;
  const affiliations = Array.isArray(record.affiliations)
    ? record.affiliations
        .map(String)
        .map(normalizeAffiliationLabel)
        .filter(Boolean)
    : [];
  const authors = Array.isArray(record.authors)
    ? record.authors
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const obj = item as Record<string, unknown>;
          const firstName = String(obj.firstName ?? obj.first_name ?? "").trim();
          const lastName = String(obj.lastName ?? obj.last_name ?? "").trim();
          const middleName = String(obj.middleName ?? obj.middle_name ?? "").trim();
          if (!firstName && !lastName && !middleName) return null;
          const rawAffiliationTexts = obj.affiliationTexts ?? obj.affiliation_texts;
          const affiliationTexts = Array.isArray(rawAffiliationTexts)
            ? rawAffiliationTexts
                .map(String)
                .map(normalizeAffiliationLabel)
                .filter(Boolean)
            : [];
          const entry = {
            firstName,
            lastName,
            affiliationTexts,
            ...(middleName ? { middleName } : {}),
            ...(String(obj.orcid ?? "").trim() ? { orcid: String(obj.orcid).trim() } : {}),
            ...(String(obj.email ?? "").trim() ? { email: String(obj.email).trim() } : {}),
          };
          return entry;
        })
        .filter(Boolean)
    : [];
  return { affiliations, authors: authors as ContributorsRegistry["authors"] };
}

export async function readContributorsRegistry(modelRoot: string): Promise<ContributorsRegistry> {
  try {
    const raw = await readFile(registryPath(modelRoot), "utf8");
    return parseRegistry(raw);
  } catch {
    return emptyContributorsRegistry();
  }
}

export async function writeContributorsRegistry(
  modelRoot: string,
  registry: ContributorsRegistry,
): Promise<void> {
  const payload = {
    affiliations: registry.affiliations,
    authors: registry.authors.map((author) => {
      const record: Record<string, unknown> = {
        firstName: author.firstName,
        lastName: author.lastName,
      };
      if (author.middleName) record.middleName = author.middleName;
      if (author.orcid) record.orcid = author.orcid;
      if (author.email) record.email = author.email;
      if (author.affiliationTexts.length > 0) record.affiliationTexts = author.affiliationTexts;
      return record;
    }),
  };
  await writeFile(registryPath(modelRoot), yaml.dump(payload, { lineWidth: 120 }), "utf8");
}

export async function upsertContributorsFromManuscript(
  modelRoot: string,
  authors: AuthorEntry[],
  affiliations: string[],
): Promise<ContributorsRegistry> {
  const current = await readContributorsRegistry(modelRoot);
  const next = mergeContributorsRegistry(current, authors, affiliations);
  await writeContributorsRegistry(modelRoot, next);
  return next;
}

/** Merge manuscript authors into the global registry after save. */
export async function syncContributorsAfterManuscriptSave(
  modelRoot: string,
  authors: AuthorEntry[],
  affiliations: string[],
): Promise<void> {
  await upsertContributorsFromManuscript(modelRoot, authors, affiliations);
}
