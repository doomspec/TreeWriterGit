export type DispatchAction =
  | "draft"
  | "revise"
  | "expand"
  | "cite-check"
  | "custom"
  | "refresh-index"
  | "sync-outline"
  | "summarize-outline"
  | "generate-figure"
  | "draft-from-notes"
  | "outline-from-notes"
  | "notes-from-draft"
  | "notes-from-outline";

/** Actions that write into unit-scoped scratch notes (temp-notes.md) rather than the manuscript. */
export const NOTES_TARGET_ACTIONS = new Set<DispatchAction>(["notes-from-draft", "notes-from-outline"]);

/** Actions that write into outline.md rather than draft.md. */
export const OUTLINE_TARGET_ACTIONS = new Set<DispatchAction>([
  "refresh-index",
  "sync-outline",
  "summarize-outline",
  "outline-from-notes",
]);

// Template variables: {idea}, {draft}, {notes}, {context}, {outputPath}, {outlinePath}, {customPrompt}
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

  "draft-from-notes": `Write a complete, publication-quality paragraph for the following section of a scientific paper, using the author's working notes below as the primary source material.

SECTION OVERVIEW (outline.md):
{idea}

AUTHOR'S NOTES (temp-notes.md — primary source for this draft):
{notes}

{context}

Write the manuscript paragraph directly to file {outputPath}. Overwrite any existing content. Convert the notes' claims and ideas into formal academic prose. No preamble or meta-commentary — output only the paragraph text that will appear in the final manuscript.`,

  "outline-from-notes": `Update the section overview (outline.md) using the author's working notes as the primary source.

CURRENT OVERVIEW:
{idea}

AUTHOR'S NOTES (temp-notes.md — primary source for this outline):
{notes}

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep \`# Title\` as the first line.
- Use \`Overview:\` followed by a concise bullet list (4–6 bullets max, one line each) capturing the claims and ideas from the notes.
- Do not write narrative paragraphs or meta-commentary.`,

  "notes-from-draft": `Distill the current draft paragraph into a short scratchpad note capturing its key claims and ideas, for the author's own future reference — not for publication.

CURRENT DRAFT:
{draft}

Write the notes directly to file {outputPath}. Overwrite any existing content. Use terse bullet points, not prose. This is a private scratchpad — no citation formatting needed.`,

  "notes-from-outline": `Distill the current section overview into a short scratchpad note capturing its key points, for the author's own future reference — not for publication.

CURRENT OVERVIEW:
{idea}

Write the notes directly to file {outputPath}. Overwrite any existing content. Use terse bullet points, not prose. This is a private scratchpad, not manuscript text.`,
};

export function actionNeedsDraft(action: DispatchAction): boolean {
  return (
    action !== "draft" &&
    action !== "custom" &&
    action !== "refresh-index" &&
    action !== "summarize-outline" &&
    action !== "generate-figure" &&
    action !== "draft-from-notes" &&
    action !== "outline-from-notes" &&
    action !== "notes-from-outline"
  );
}

/** Actions whose template references the author's scratch notes (temp-notes.md). */
export function actionNeedsNotes(action: DispatchAction): boolean {
  return action === "draft-from-notes" || action === "outline-from-notes";
}
