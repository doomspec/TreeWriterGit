import { useMemo } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useContributorsRegistry } from "@/lib/useContributorsRegistry";
import { cn } from "@/lib/utils";
import {
  affiliationMatchKey,
  authorFullName,
  authorRegistryKey,
  importRegistryAffiliation,
  importRegistryAuthor,
  type ContributorsRegistry,
} from "@treewriter/shared";
import type { AuthorEntry } from "@treewriter/shared";

export type AuthorsAffiliationsValue = {
  authors: AuthorEntry[];
  affiliations: string[];
};

function emptyAuthor(): AuthorEntry {
  return { firstName: "", lastName: "", affiliations: [] };
}

/**
 * Structured authors + affiliations editor for the manuscript modal. Each
 * author has separate name parts, an ORCID, one or more numbered affiliations,
 * and equal-contribution / corresponding flags. Feeds the LaTeX title block
 * (see buildAuthorBlock) and the CRediT tab (ContributionsEditor).
 */
export function AuthorsAffiliationsEditor({
  value,
  onChange,
  registry: registryProp,
  registryRefreshVersion,
}: {
  value: AuthorsAffiliationsValue;
  onChange: (next: AuthorsAffiliationsValue) => void;
  /** When set, skips fetching `/api/contributors` (used in tests). */
  registry?: ContributorsRegistry;
  registryRefreshVersion?: number;
}) {
  const { authors, affiliations } = value;
  const { registry: loadedRegistry } = useContributorsRegistry({
    initialRegistry: registryProp,
    refreshVersion: registryRefreshVersion,
  });
  const registry = registryProp ?? loadedRegistry;

  const existingAuthorKeys = useMemo(
    () => new Set(authors.map((author) => authorRegistryKey(author)).filter(Boolean)),
    [authors],
  );

  const pickableAuthors = useMemo(
    () =>
      registry.authors.filter((author) => {
        const key = authorRegistryKey(author);
        return key && !existingAuthorKeys.has(key);
      }),
    [registry.authors, existingAuthorKeys],
  );

  const existingAffiliationKeys = useMemo(
    () => new Set(affiliations.map(affiliationMatchKey).filter(Boolean)),
    [affiliations],
  );

  const pickableAffiliations = useMemo(
    () =>
      registry.affiliations.filter((text) => {
        const key = affiliationMatchKey(text);
        return key && !existingAffiliationKeys.has(key);
      }),
    [registry.affiliations, existingAffiliationKeys],
  );

  const patchAuthor = (index: number, patch: Partial<AuthorEntry>) => {
    onChange({
      ...value,
      authors: authors.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    });
  };

  const addAuthor = () => onChange({ ...value, authors: [...authors, emptyAuthor()] });
  const removeAuthor = (index: number) =>
    onChange({ ...value, authors: authors.filter((_, i) => i !== index) });

  const pickAuthorFromLibrary = (index: string) => {
    const registryAuthor = pickableAuthors[Number(index)];
    if (!registryAuthor) return;
    onChange({ ...value, ...importRegistryAuthor(registryAuthor, authors, affiliations) });
  };

  const pickAffiliationFromLibrary = (index: string) => {
    const affiliationText = pickableAffiliations[Number(index)];
    if (!affiliationText) return;
    onChange({
      ...value,
      affiliations: importRegistryAffiliation(affiliationText, affiliations),
    });
  };

  const toggleAuthorAffiliation = (index: number, affNumber: number) => {
    const current = authors[index]?.affiliations ?? [];
    const next = current.includes(affNumber)
      ? current.filter((n) => n !== affNumber)
      : [...current, affNumber].sort((a, b) => a - b);
    patchAuthor(index, { affiliations: next });
  };

  const setAffiliation = (index: number, text: string) =>
    onChange({ ...value, affiliations: affiliations.map((a, i) => (i === index ? text : a)) });

  const addAffiliation = () => onChange({ ...value, affiliations: [...affiliations, ""] });

  const removeAffiliation = (index: number) => {
    const removed = index + 1;
    // Drop the affiliation and renumber every author's references: the removed
    // number goes away, higher numbers shift down by one.
    const nextAuthors = authors.map((author) => ({
      ...author,
      affiliations: author.affiliations
        .filter((n) => n !== removed)
        .map((n) => (n > removed ? n - 1 : n)),
    }));
    onChange({
      authors: nextAuthors,
      affiliations: affiliations.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-foreground">Authors</label>
          <div className="flex items-center gap-1">
            {pickableAuthors.length > 0 ? (
              <select
                aria-label="Add author from library"
                className="h-6 max-w-[9rem] truncate rounded-md border border-border bg-background px-1.5 text-[10px] text-muted-foreground"
                value=""
                onChange={(event) => pickAuthorFromLibrary(event.target.value)}
              >
                <option value="">From library…</option>
                {pickableAuthors.map((author, index) => (
                  <option key={authorRegistryKey(author) ?? index} value={index}>
                    {authorFullName(author)}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={addAuthor}>
              <Plus className="h-3 w-3" aria-hidden="true" />
              Author
            </Button>
          </div>
        </div>
        {authors.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No authors yet.</p>
        ) : (
          <ul className="space-y-2">
            {authors.map((author, index) => (
              <li key={index} className="rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-start gap-1.5">
                  <div className="grid min-w-0 flex-1 grid-cols-[1fr_0.8fr_1fr] gap-1">
                    <input
                      type="text"
                      value={author.firstName}
                      placeholder="First"
                      aria-label={`Author ${index + 1} first name`}
                      className="h-7 min-w-0 rounded-md border border-border bg-background px-2 text-xs"
                      onChange={(e) => patchAuthor(index, { firstName: e.target.value })}
                    />
                    <input
                      type="text"
                      value={author.middleName ?? ""}
                      placeholder="Middle"
                      aria-label={`Author ${index + 1} middle name`}
                      className="h-7 min-w-0 rounded-md border border-border bg-background px-2 text-xs"
                      onChange={(e) => patchAuthor(index, { middleName: e.target.value })}
                    />
                    <input
                      type="text"
                      value={author.lastName}
                      placeholder="Last"
                      aria-label={`Author ${index + 1} last name`}
                      className="h-7 min-w-0 rounded-md border border-border bg-background px-2 text-xs"
                      onChange={(e) => patchAuthor(index, { lastName: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove author ${index + 1}`}
                    className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAuthor(index)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <input
                  type="text"
                  value={author.orcid ?? ""}
                  placeholder="ORCID (0000-0000-0000-0000)"
                  aria-label={`Author ${index + 1} ORCID`}
                  className="mt-1 h-7 w-full rounded-md border border-border bg-background px-2 text-xs"
                  onChange={(e) => patchAuthor(index, { orcid: e.target.value })}
                />

                {affiliations.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
                    <span className="mr-1 text-[10px] text-muted-foreground">Affiliations:</span>
                    {affiliations.map((_, affIdx) => {
                      const affNumber = affIdx + 1;
                      const active = (author.affiliations ?? []).includes(affNumber);
                      return (
                        <button
                          key={affNumber}
                          type="button"
                          aria-label={`Toggle affiliation ${affNumber} for author ${index + 1}`}
                          aria-pressed={active}
                          title={`Affiliation ${affNumber}`}
                          className={cn(
                            "h-6 w-6 shrink-0 rounded-md border text-[10px] font-medium",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:bg-accent",
                          )}
                          onClick={() => toggleAuthorAffiliation(index, affNumber)}
                        >
                          {affNumber}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={Boolean(author.equalContribution)}
                      aria-label={`Author ${index + 1} equal contribution`}
                      onChange={(e) => patchAuthor(index, { equalContribution: e.target.checked })}
                    />
                    Equal contribution
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={Boolean(author.corresponding)}
                      aria-label={`Author ${index + 1} corresponding`}
                      onChange={(e) => patchAuthor(index, { corresponding: e.target.checked })}
                    />
                    Corresponding
                  </label>
                  {author.corresponding ? (
                    <input
                      type="email"
                      value={author.email ?? ""}
                      placeholder="Correspondence email"
                      aria-label={`Author ${index + 1} email`}
                      className="h-6 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[11px]"
                      onChange={(e) => patchAuthor(index, { email: e.target.value })}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-foreground">Affiliations</label>
          <div className="flex items-center gap-1">
            {pickableAffiliations.length > 0 ? (
              <select
                aria-label="Add affiliation from library"
                className="h-6 max-w-[9rem] truncate rounded-md border border-border bg-background px-1.5 text-[10px] text-muted-foreground"
                value=""
                onChange={(event) => pickAffiliationFromLibrary(event.target.value)}
              >
                <option value="">From library…</option>
                {pickableAffiliations.map((affiliation, index) => (
                  <option key={affiliationMatchKey(affiliation)} value={index}>
                    {affiliation}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={addAffiliation}>
              <Plus className="h-3 w-3" aria-hidden="true" />
              Affiliation
            </Button>
          </div>
        </div>
        {affiliations.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No affiliations. Add them to number authors in the LaTeX title block.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {affiliations.map((affiliation, index) => (
              <li key={index} className="flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-right text-[10px] font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={affiliation}
                  placeholder="Department, Institution, City"
                  aria-label={`Affiliation ${index + 1}`}
                  className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                  onChange={(event) => setAffiliation(index, event.target.value)}
                />
                <button
                  type="button"
                  aria-label={`Remove affiliation ${index + 1}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAffiliation(index)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
