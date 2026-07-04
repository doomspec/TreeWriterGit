import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";

import { authorFullName } from "@treewriter/shared";

import type { PaperDetail } from "@/modelApi";

function AuthorContributions({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false);
  if (roles.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span>Contributions ({roles.length})</span>
      </button>
      {open ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {roles.map((role) => (
            <span
              key={role}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {role}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PaperAuthorsSection({
  detail,
  onEdit,
  onRemove,
}: {
  detail: PaperDetail;
  onEdit: () => void;
  onRemove: (index: number) => void;
}) {
  const authors = detail.authorDetails
    .map((author, index) => ({ author, index, name: authorFullName(author).trim() }))
    .filter((entry) => entry.name);

  return (
    <>
      {authors.length > 0 ? (
        <ul className="space-y-2">
          {authors.map(({ author, index, name }) => {
            const marks: string[] = [...author.affiliations.map(String)];
            if (author.equalContribution) marks.push("†");
            if (author.corresponding) marks.push("*");
            return (
              <li key={index} className="rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center gap-1">
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {name}
                    {marks.length > 0 ? (
                      <sup className="ml-0.5 text-[9px] text-muted-foreground">{marks.join(",")}</sup>
                    ) : null}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      title="Edit author"
                      aria-label={`Edit ${name}`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      onClick={onEdit}
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="Remove author"
                      aria-label={`Remove ${name}`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {author.orcid ? (
                  <p className="truncate text-[10px] text-muted-foreground">ORCID: {author.orcid}</p>
                ) : null}
                {author.corresponding && author.email ? (
                  <p className="truncate text-[10px] text-muted-foreground">{author.email}</p>
                ) : null}
                <AuthorContributions roles={author.credit ?? []} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">No authors listed.</p>
      )}

      {detail.affiliations.length > 0 ? (
        <div className={authors.length > 0 ? "border-t border-border/60 pt-2" : undefined}>
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">Affiliations</p>
          <ol className="list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground">
            {detail.affiliations.map((affiliation, index) => (
              <li key={index}>{affiliation}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </>
  );
}

export function hasAuthorContent(detail: PaperDetail): boolean {
  return (
    detail.authorDetails.some((author) => authorFullName(author).trim()) ||
    detail.affiliations.length > 0
  );
}
