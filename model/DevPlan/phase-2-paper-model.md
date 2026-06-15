---
title: Phase 2 — Scientific Paper Model
summary: Implement the paper-specific directory structure, metadata, templates, and status tracking inside TreeWriter.
composed_at_commit: null
---

# Phase 2 — Scientific Paper Model

**Effort:** 2–3 days  
**What it builds:** the model directory conventions from architecture.md, plus UI affordances specific to scientific writing

## Paper Creation Wizard

New button: "New Paper" → modal collects:

- Paper title
- Target journal (Nature / Cell / PLOS ONE / custom)
- Authors (from `model/shared/authors.md`)
- Status (Planning / Drafting / Reviewing / Submitted)

Creates full scaffold:

```
model/papers/{slug}/
├── INDEX.md              ← metadata block + section order
├── outlines/
│   ├── INDEX.md
│   ├── abstract.md       ← pre-filled with journal word limit
│   ├── introduction.md
│   ├── methods.md
│   ├── results.md
│   └── discussion.md
├── notes/
│   ├── INDEX.md
│   └── literature/
│       └── INDEX.md
├── drafts/
│   └── INDEX.md
└── final/
    └── INDEX.md
```

Journal templates stored in `model/templates/` define section order, word budgets, and style notes.

## Paper INDEX.md Metadata Schema

```yaml
---
title: "ML Cell Counting Reproducibility Study"
journal: PLOS ONE
status: Drafting          # Planning | Drafting | Reviewing | Submitted | Published
authors:
  - Ilya Kavets
  - [co-author]
target_words: 5000
section_order:
  - outlines/abstract.md
  - outlines/introduction.md
  - outlines/methods.md
  - outlines/results.md
  - outlines/discussion.md
overleaf_project_id: null  # set once Overleaf link is established
last_export: null
---
```

## Outline File Schema

Each file in `outlines/` defines what that section needs to say:

```markdown
---
section: Introduction
target_words: 800
status: outline           # outline | drafted | approved | final
ai_context:
  - "Establish that cell viability counting is a bottleneck in biomanufacturing"
  - "Argue that inter-operator variability limits scalability"
  - "Position LiveCount as an ML solution"
  - "State: we recruited N=11 operators to test reproducibility"
citations_required:
  - hemocytometer-error-rates
  - ml-cell-counting-survey
---

# Introduction

## Key Claims
1. Manual hemocytometer counting is subjective and slow at scale
2. ML-assisted tools exist but reproducibility across operators is uncharacterized
3. This study quantifies reproducibility of LiveCount across N=11 participants

## Evidence Available
- See notes/data/participant-stats.md (time savings, viability SD)
- See notes/literature/existing-tools.md
```

## Status Tracking Dashboard

New view in sidebar: "Papers" panel showing:

| Paper | Journal | Status | Sections drafted | Last export |
|-------|---------|--------|-----------------|-------------|

Clicking a section shows which stage it's at (outline → drafted → approved → final).

## Notes System

`notes/` is the working memory for the paper. Three subdirectory types:

**`notes/literature/`** — one file per reference:
```markdown
---
cite_key: hemocytometer-1962
authors: [Bürker]
year: 1962
claim: "Hemocytometer counting has ±15% inter-operator CV"
relevance: [introduction, methods]
---
```

**`notes/data/`** — links to figures and stats:
```markdown
---
figure: participant_time_statistics.png
path: /path/to/ML/plots/participant_time_statistics.png
caption_draft: "Completion time for manual vs LiveCount across 11 participants"
sections: [results]
---
```

**`notes/feedback/`** — imported Overleaf comments + reviewer notes:
```markdown
---
source: overleaf
date: 2026-06-15
reviewer: Reviewer 2
section: Introduction
type: comment
resolved: false
---

"The claim about inter-operator variability needs a citation to support it."
```
