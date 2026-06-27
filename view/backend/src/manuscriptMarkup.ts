/** Shared TreeWriter draft.md markup conventions — keep in sync with `.cursor/rules/treewriter-manuscript.mdc`. */
export const MANUSCRIPT_MARKUP = `MANUSCRIPT MARKUP (TreeWriter draft.md conventions):

Citations — use Pandoc cite syntax, NOT LaTeX \\cite{}:
- Single: [@smith2024]
- Multiple: [@smith2024; @jones2020]  (semicolon + space between keys; each key prefixed with @)

Figures — embed on its own line in draft.md:
::figure[papers/<paper>/figures/<name>]

Equations — embed on its own line in draft.md:
::equation[papers/<paper>/equations/<name>]

Tables and in-text cross-references — wikilink:
[[papers/<paper>/tables/<name>|Table label]]

Do not use LaTeX \\cite{}, \\fig{}, \\table{}, or \\eq{} in draft.md; those are editor autocomplete shortcuts only.
When revising existing text, preserve [@…] citations and convert any \\cite{…} you encounter to [@…] form.`;

const DRAFT_MARKUP_ACTIONS = new Set(["draft", "revise", "expand", "cite-check"]);

export function shouldIncludeManuscriptMarkup(
  action: string,
  outputRelPath: string,
): boolean {
  if (DRAFT_MARKUP_ACTIONS.has(action)) return true;
  if (action === "custom" && outputRelPath.endsWith("/draft.md")) return true;
  return false;
}
