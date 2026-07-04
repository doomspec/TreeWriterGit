import { CREDIT_ROLES, authorFullName, type AuthorEntry, type CreditRole } from "@treewriter/shared";

import { cn } from "@/lib/utils";

/**
 * CRediT contributor-roles editor: per author, toggle any of the 14 standard
 * roles (credit.niso.org). Writes back into each author's `credit` list, which
 * the LaTeX export turns into an "Author contributions" statement.
 */
export function ContributionsEditor({
  authors,
  onChange,
}: {
  authors: AuthorEntry[];
  onChange: (authors: AuthorEntry[]) => void;
}) {
  const toggleRole = (index: number, role: CreditRole) => {
    onChange(
      authors.map((author, i) => {
        if (i !== index) return author;
        const current = author.credit ?? [];
        const next = current.includes(role)
          ? current.filter((r) => r !== role)
          : CREDIT_ROLES.filter((r) => r === role || current.includes(r));
        return { ...author, credit: next };
      }),
    );
  };

  const named = authors.filter((a) => authorFullName(a).trim().length > 0);
  if (named.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Add authors on the Authors tab first, then assign CRediT roles here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        CRediT contributor roles (credit.niso.org). Toggle the roles each author performed; they export as
        an “Author contributions” statement.
      </p>
      <ul className="space-y-2">
        {authors.map((author, index) => {
          const name = authorFullName(author).trim();
          if (!name) return null;
          const roles = author.credit ?? [];
          return (
            <li key={index} className="rounded-md border border-border/60 bg-muted/20 p-2">
              <p className="mb-1 truncate text-xs font-medium text-foreground">{name}</p>
              <div className="flex flex-wrap gap-1">
                {CREDIT_ROLES.map((role) => {
                  const active = roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${role} for ${name}`}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px]",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                      onClick={() => toggleRole(index, role)}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
