import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AuthorsAffiliationsValue = {
  authors: string[];
  affiliations: string[];
  /** Parallel to authors; each entry lists 1-based affiliation indices. */
  authorAffiliations: number[][];
};

/**
 * Structured authors + affiliations editor for the manuscript modal. Authors
 * are individual rows (so a name may contain commas), each toggling which
 * numbered affiliations apply; affiliations are a numbered, reorderable-by-
 * position list. Feeds the LaTeX title block (see buildNatureMainTexDocument).
 */
export function AuthorsAffiliationsEditor({
  value,
  onChange,
}: {
  value: AuthorsAffiliationsValue;
  onChange: (next: AuthorsAffiliationsValue) => void;
}) {
  const { authors, affiliations, authorAffiliations } = value;

  const affFor = (index: number): number[] => authorAffiliations[index] ?? [];

  const setAuthorName = (index: number, name: string) => {
    const nextAuthors = authors.map((a, i) => (i === index ? name : a));
    onChange({ ...value, authors: nextAuthors });
  };

  const addAuthor = () => {
    onChange({
      ...value,
      authors: [...authors, ""],
      authorAffiliations: [...authorAffiliations, []],
    });
  };

  const removeAuthor = (index: number) => {
    onChange({
      ...value,
      authors: authors.filter((_, i) => i !== index),
      authorAffiliations: authorAffiliations.filter((_, i) => i !== index),
    });
  };

  const toggleAuthorAffiliation = (authorIndex: number, affNumber: number) => {
    const current = affFor(authorIndex);
    const next = current.includes(affNumber)
      ? current.filter((n) => n !== affNumber)
      : [...current, affNumber].sort((a, b) => a - b);
    const nextMap = authors.map((_, i) => (i === authorIndex ? next : affFor(i)));
    onChange({ ...value, authorAffiliations: nextMap });
  };

  const setAffiliation = (index: number, text: string) => {
    onChange({ ...value, affiliations: affiliations.map((a, i) => (i === index ? text : a)) });
  };

  const addAffiliation = () => {
    onChange({ ...value, affiliations: [...affiliations, ""] });
  };

  const removeAffiliation = (index: number) => {
    const removedNumber = index + 1;
    // Drop the removed affiliation and renumber every author's references:
    // indices above the removed one shift down by one; the removed one is dropped.
    const nextMap = authorAffiliations.map((entry) =>
      entry
        .filter((n) => n !== removedNumber)
        .map((n) => (n > removedNumber ? n - 1 : n)),
    );
    onChange({
      ...value,
      affiliations: affiliations.filter((_, i) => i !== index),
      authorAffiliations: nextMap,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Authors</label>
          <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={addAuthor}>
            <Plus className="h-3 w-3" aria-hidden="true" />
            Author
          </Button>
        </div>
        {authors.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No authors yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {authors.map((author, index) => (
              <li key={index} className="flex items-start gap-1.5">
                <input
                  type="text"
                  value={author}
                  placeholder="Full name"
                  aria-label={`Author ${index + 1} name`}
                  className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                  onChange={(event) => setAuthorName(index, event.target.value)}
                />
                {affiliations.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-0.5 pt-0.5">
                    {affiliations.map((_, affIdx) => {
                      const affNumber = affIdx + 1;
                      const active = affFor(index).includes(affNumber);
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
                <button
                  type="button"
                  aria-label={`Remove author ${index + 1}`}
                  className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAuthor(index)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Affiliations</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={addAffiliation}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Affiliation
          </Button>
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
