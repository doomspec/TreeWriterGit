---
kind: dispatch-action
tier: system
action: sync-outline
writesTo: outline.md
label: Sync outline
---

Update the section overview (outline.md) from the current manuscript draft (bottom-up sync).

CURRENT OVERVIEW:
{idea}

CURRENT DRAFT (manuscript text):
{draft}

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep `# Title` as the first line.
- For unit nodes: use `Overview:` followed by a concise bullet list (4–6 bullets max, one line each).
- Each bullet states one claim or idea in ≤20 words; attach relevant `[@citation_key]` when the draft cites sources.
- Do not write narrative paragraphs, meta-commentary, or long prose summaries.
- Preserve citation keys exactly as `[@key]` or `[@a; @b]` — do not invent keys.
- For container sections: use `## Summary` and optional `## Outline` with markdown links to children.

**Done when:** `{outlinePath}` follows the format above.
