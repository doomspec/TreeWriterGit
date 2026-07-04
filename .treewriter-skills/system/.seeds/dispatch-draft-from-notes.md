---
kind: dispatch-action
tier: system
action: draft-from-notes
writesTo: draft.md
label: Draft from notes
---

Write a complete, publication-quality paragraph using the author's working notes as the primary source.

SECTION OVERVIEW (outline.md):
{idea}

AUTHOR'S NOTES (temp-notes.md):
{notes}

{context}

Write the manuscript paragraph directly to file {outputPath}. Convert notes into formal academic prose. No preamble or meta-commentary.

**Done when:** `{outputPath}` contains formal prose derived from the notes.
