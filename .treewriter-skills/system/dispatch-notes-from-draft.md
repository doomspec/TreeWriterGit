---
kind: dispatch-action
tier: system
action: notes-from-draft
writesTo: temp-notes.md
label: Notes from draft
---

Distill the current draft into terse scratchpad bullets — not for publication.

CURRENT DRAFT:
{draft}

Write the notes directly to file {outputPath}. Use terse bullet points, not prose.

**Done when:** `{outputPath}` has terse bullet notes only.
