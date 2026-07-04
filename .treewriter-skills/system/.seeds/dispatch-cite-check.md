---
kind: dispatch-action
tier: system
action: cite-check
writesTo: draft.md
label: Cite-check
---

Review the following paragraph and identify any claims that need citations. Add citation placeholders in the form [@cite_key].

CURRENT DRAFT:
{draft}

{context}

Write the annotated paragraph directly to file {outputPath}.

**Done when:** every unsupported claim in `{outputPath}` has a `[@cite_key]` or existing citation retained.
