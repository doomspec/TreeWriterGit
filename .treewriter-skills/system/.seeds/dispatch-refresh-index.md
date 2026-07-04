---
kind: dispatch-action
tier: system
action: refresh-index
writesTo: outline.md
label: Refresh
---

Regenerate the user-facing section overview (outline.md) from its child folders and files.

CURRENT OVERVIEW:
{idea}

{context}

Write an updated outline.md to {outlinePath}. Include ## Summary and ## Outline sections with markdown links to children. Do not write to INDEX.md — that file holds technical metadata only.

**Done when:** `{outlinePath}` has Summary + Outline with child links.
