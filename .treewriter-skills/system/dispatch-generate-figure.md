---
kind: dispatch-action
tier: system
action: generate-figure
writesTo: figure source
label: Make figure
---

Generate or update a scientific figure as Mermaid source for this figure unit.

FIGURE BRIEF (outline.md):
{idea}

CURRENT CAPTION (draft.md):
{draft}

{context}

Write Mermaid diagram source to {figureSourcePath}. Prefer flowchart TD or LR unless another diagram type fits better. Optionally update the caption in {captionPath} if needed.

**Done when:** `{figureSourcePath}` contains valid Mermaid source.
