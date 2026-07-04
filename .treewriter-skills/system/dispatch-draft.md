---
kind: dispatch-action
tier: system
action: draft
writesTo: draft.md
label: Make draft
---

Write a complete, publication-quality paragraph for the following section of a scientific paper.

SECTION OVERVIEW (outline.md):
{idea}

{context}

Write the manuscript paragraph directly to file {outputPath}. Overwrite any existing content. Use formal academic language. No preamble or meta-commentary — output only the paragraph text that will appear in the final manuscript.

**Done when:** `{outputPath}` contains the paragraph only — no headings or meta-commentary.
