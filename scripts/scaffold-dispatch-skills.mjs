#!/usr/bin/env node
/**
 * Extract dispatch action prompts → .treewriter-skills/system/dispatch-*.md
 * Run: node scripts/scaffold-dispatch-skills.mjs
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const ACTION_META = {
  draft: { label: "Make draft", writesTo: "draft.md" },
  revise: { label: "Revise", writesTo: "draft.md" },
  expand: { label: "Expand", writesTo: "draft.md" },
  "cite-check": { label: "Cite-check", writesTo: "draft.md" },
  custom: { label: "Custom", writesTo: "draft.md" },
  "refresh-index": { label: "Refresh", writesTo: "outline.md" },
  "sync-outline": { label: "Sync outline", writesTo: "outline.md" },
  "summarize-outline": { label: "Make outline", writesTo: "outline.md" },
  "generate-figure": { label: "Make figure", writesTo: "figure source" },
  "draft-from-notes": { label: "Draft from notes", writesTo: "draft.md" },
  "outline-from-notes": { label: "Outline from notes", writesTo: "outline.md" },
  "notes-from-draft": { label: "Notes from draft", writesTo: "temp-notes.md" },
  "notes-from-outline": { label: "Notes from outline", writesTo: "temp-notes.md" },
};

// Bodies mirror view/backend/src/agentDispatch/templates.ts + completion criteria.
const TEMPLATES = {
  draft: `Write a complete, publication-quality paragraph for the following section of a scientific paper.

SECTION OVERVIEW (outline.md):
{idea}

{context}

Write the manuscript paragraph directly to file {outputPath}. Overwrite any existing content. Use formal academic language. No preamble or meta-commentary — output only the paragraph text that will appear in the final manuscript.

**Done when:** \`{outputPath}\` contains the paragraph only — no headings or meta-commentary.`,

  revise: `Revise the following draft paragraph for clarity, precision, and scientific rigor.

SECTION OVERVIEW (what this paragraph must convey):
{idea}

CURRENT DRAFT:
{draft}

{context}

Write the revised paragraph directly to file {outputPath}. Preserve all factual claims and citations.

**Done when:** \`{outputPath}\` holds the revised paragraph with citations and embeds preserved.`,

  expand: `Expand the following paragraph with additional detail, supporting evidence, and improved transitions.

SECTION OVERVIEW:
{idea}

CURRENT DRAFT:
{draft}

{context}

Write the expanded version directly to file {outputPath}.

**Done when:** \`{outputPath}\` contains the expanded paragraph only.`,

  "cite-check": `Review the following paragraph and identify any claims that need citations. Add citation placeholders in the form [@cite_key].

CURRENT DRAFT:
{draft}

{context}

Write the annotated paragraph directly to file {outputPath}.

**Done when:** every unsupported claim in \`{outputPath}\` has a \`[@cite_key]\` or existing citation retained.`,

  custom: `{customPrompt}

Target file: {outputPath}

**Done when:** \`{outputPath}\` matches the custom instruction.`,

  "refresh-index": `Regenerate the user-facing section overview (outline.md) from its child folders and files.

CURRENT OVERVIEW:
{idea}

{context}

Write an updated outline.md to {outlinePath}. Include ## Summary and ## Outline sections with markdown links to children. Do not write to INDEX.md — that file holds technical metadata only.

**Done when:** \`{outlinePath}\` has Summary + Outline with child links.`,

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
- Do not write narrative paragraphs, meta-commentary, or long prose summaries.
- Preserve citation keys exactly as \`[@key]\` or \`[@a; @b]\` — do not invent keys.
- For container sections: use \`## Summary\` and optional \`## Outline\` with markdown links to children.

**Done when:** \`{outlinePath}\` follows the format above.`,

  "summarize-outline": `Update this section's overview (outline.md) by synthesizing all downstream child content.

CURRENT SECTION OVERVIEW:
{idea}

DOWNSTREAM PARTS (direct children, nested subsections, and units):
{context}

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep \`# Title\` as the first line.
- Add \`## Summary\` with 4–8 concise bullets synthesizing downstream content.
- Add \`## Outline\` listing every direct child as a markdown link.
- Do not paste full child outlines — synthesize at this section level only.
- Do not write to INDEX.md.

**Done when:** \`{outlinePath}\` has Summary bullets + Outline links for all direct children.`,

  "generate-figure": `Generate or update a scientific figure as Mermaid source for this figure unit.

FIGURE BRIEF (outline.md):
{idea}

CURRENT CAPTION (draft.md):
{draft}

{context}

Write Mermaid diagram source to {figureSourcePath}. Prefer flowchart TD or LR unless another diagram type fits better. Optionally update the caption in {captionPath} if needed.

**Done when:** \`{figureSourcePath}\` contains valid Mermaid source.`,

  "draft-from-notes": `Write a complete, publication-quality paragraph using the author's working notes as the primary source.

SECTION OVERVIEW (outline.md):
{idea}

AUTHOR'S NOTES (temp-notes.md):
{notes}

{context}

Write the manuscript paragraph directly to file {outputPath}. Convert notes into formal academic prose. No preamble or meta-commentary.

**Done when:** \`{outputPath}\` contains formal prose derived from the notes.`,

  "outline-from-notes": `Update the section overview (outline.md) using the author's working notes.

CURRENT OVERVIEW:
{idea}

AUTHOR'S NOTES (temp-notes.md):
{notes}

Write an updated outline.md to {outlinePath}. Use \`Overview:\` with 4–6 concise bullets from the notes.

**Done when:** \`{outlinePath}\` has Overview bullets from the notes.`,

  "notes-from-draft": `Distill the current draft into terse scratchpad bullets — not for publication.

CURRENT DRAFT:
{draft}

Write the notes directly to file {outputPath}. Use terse bullet points, not prose.

**Done when:** \`{outputPath}\` has terse bullet notes only.`,

  "notes-from-outline": `Distill the current section overview into terse scratchpad bullets.

CURRENT OVERVIEW:
{idea}

Write the notes directly to file {outputPath}. Use terse bullet points, not prose.

**Done when:** \`{outputPath}\` has terse bullet notes only.`,
};

async function main() {
  const systemDir = path.join(repoRoot, ".treewriter-skills", "system");
  const seedsDir = path.join(systemDir, ".seeds");
  await mkdir(seedsDir, { recursive: true });

  for (const [action, body] of Object.entries(TEMPLATES)) {
    const meta = ACTION_META[action];
    const filename = `dispatch-${action}.md`;
    const content = `---
kind: dispatch-action
tier: system
action: ${action}
writesTo: ${meta.writesTo}
label: ${meta.label}
---

${body.trim()}
`;
    const dest = path.join(systemDir, filename);
    await writeFile(dest, content, "utf8");
    await copyFile(dest, path.join(seedsDir, filename));
    console.log("wrote", filename);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
