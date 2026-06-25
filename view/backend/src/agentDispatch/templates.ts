export type DispatchAction =
  | "draft"
  | "revise"
  | "expand"
  | "cite-check"
  | "custom"
  | "refresh-index"
  | "sync-outline"
  | "summarize-outline"
  | "generate-figure";

// Template variables: {idea}, {draft}, {context}, {outputPath}, {outlinePath}, {customPrompt}
export const TEMPLATES: Record<DispatchAction, string> = {
  draft: `Write a complete, publication-quality paragraph for the following section of a scientific paper.

SECTION OVERVIEW (outline.md):
{idea}

{context}

Write the manuscript paragraph directly to file {outputPath}. Overwrite any existing content. Use formal academic language. No preamble or meta-commentary — output only the paragraph text that will appear in the final manuscript.`,

  revise: `Revise the following draft paragraph for clarity, precision, and scientific rigor.

SECTION OVERVIEW (what this paragraph must convey):
{idea}

CURRENT DRAFT:
{draft}

{context}

Write the revised paragraph directly to file {outputPath}. Preserve all factual claims and citations.`,

  expand: `Expand the following paragraph with additional detail, supporting evidence, and improved transitions.

SECTION OVERVIEW:
{idea}

CURRENT DRAFT:
{draft}

{context}

Write the expanded version directly to file {outputPath}.`,

  "cite-check": `Review the following paragraph and identify any claims that need citations. Add citation placeholders in the form [@cite_key].

CURRENT DRAFT:
{draft}

{context}

Write the annotated paragraph directly to file {outputPath}.`,

  custom: `{customPrompt}

Target file: {outputPath}`,

  "refresh-index": `Regenerate the user-facing section overview (outline.md) from its child folders and files.

CURRENT OVERVIEW:
{idea}

{context}

Write an updated outline.md to {outlinePath}. Include ## Summary and ## Outline sections with markdown links to children. Do not write to INDEX.md — that file holds technical metadata only.`,

  "sync-outline": `Update the section overview (outline.md) from the current manuscript draft (bottom-up sync).

CURRENT OVERVIEW:
{idea}

CURRENT DRAFT (manuscript text):
{draft}

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep \`# Title\` as the first line.
- For unit nodes: use \`Overview:\` followed by a concise bullet list (4–6 bullets max, one line each).
- Each bullet states one claim or idea in ≤20 words; attach relevant \`[@citation_key]\` when the draft cites sources.
- Do not write narrative paragraphs, meta-commentary ("This paragraph defines…"), or long prose summaries.
- Preserve citation keys exactly as \`[@key]\` or \`[@a; @b]\` — do not invent keys.
- For container sections (not a single paragraph unit): use \`## Summary\` and optional \`## Outline\` with markdown links to children.

The overview guides future draft revisions — be brief and scannable.`,

  "summarize-outline": `Update this section's overview (outline.md) by synthesizing all downstream child content.

CURRENT SECTION OVERVIEW:
{idea}

DOWNSTREAM PARTS (direct children, nested subsections, and units):
{context}

The context may also include:
- \`REFERENCES:\` — literature notes for \`[@cite_key]\` tokens used in downstream text (not the full bibliography)
- \`CITED ASSETS:\` — only figures, tables, and equations referenced in downstream text (do not infer uncited assets)

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep \`# Title\` as the first line (the section title).
- Add \`## Summary\` with 4–8 concise bullets that synthesize themes from all downstream outlines and drafts.
- Each bullet is one line, ≤25 words; preserve \`[@citation_key]\` when sources appear downstream.
- Add \`## Outline\` listing every direct child as a markdown link, e.g. \`- [Background](background/INDEX.md)\`.
- Do not paste full child outlines — synthesize at this section level only.
- Do not write narrative paragraphs or meta-commentary.
- Do not write to INDEX.md — that file holds technical metadata only.`,

  "generate-figure": `Generate or update a scientific figure as Mermaid source for this figure unit.

FIGURE BRIEF (outline.md):
{idea}

CURRENT CAPTION (draft.md):
{draft}

{context}

Write Mermaid diagram source to {figureSourcePath}. Use clear node labels suitable for a publication figure. Prefer flowchart TD or LR unless another diagram type fits better. Optionally update the caption in {captionPath} if needed.`,
};

export function actionNeedsDraft(action: DispatchAction): boolean {
  return (
    action !== "draft" &&
    action !== "custom" &&
    action !== "refresh-index" &&
    action !== "summarize-outline" &&
    action !== "generate-figure"
  );
}
