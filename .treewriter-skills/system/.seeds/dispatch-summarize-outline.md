---
kind: dispatch-action
tier: system
action: summarize-outline
writesTo: outline.md
label: Make outline
---

Update this section's overview (outline.md) by synthesizing all downstream child content.

CURRENT SECTION OVERVIEW:
{idea}

DOWNSTREAM PARTS (direct children, nested subsections, and units):
{context}

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep `# Title` as the first line.
- Add `## Summary` with 4–8 concise bullets synthesizing downstream content.
- Add `## Outline` listing every direct child as a markdown link.
- Do not paste full child outlines — synthesize at this section level only.
- Do not write to INDEX.md.

**Done when:** `{outlinePath}` has Summary bullets + Outline links for all direct children.
