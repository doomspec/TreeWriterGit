---
title: Phase 2 — Scientific Paper Model
summary: Recursive section→unit tree where each paragraph unit is a folder with an idea (INDEX.md) and editable generated text (draft.md); comments attach to any file; sections/units are created from the UI.
composed_at_commit: null
---

# Phase 2 — Scientific Paper Model

This is the canonical structure reference. It matches the repo's own convention ([[purpose-of-index]], `model-directory.md`): every folder is a tree node, `INDEX.md` is the node's outline/intent + child order + links, and ordinary `.md` files hold content. Here that convention is specialized for papers.

## Core Idea

A paper is a **recursive tree of folders**. Two node roles (same mechanism, distinguished by whether a `draft.md` is present):

- **Container node** (paper, section, subsection, sub-subsection): folder whose `INDEX.md` holds the node's *idea/outline* + ordered list of children + cross-links. No prose of its own.
- **Unit node** (a paragraph or atomic block): folder whose `INDEX.md` holds the *idea (the "comment" — main point, what to say, citations to hit, links)* and whose `draft.md` holds the *generated, editable prose*.

Containers nest to whatever depth a section needs (flexible/recursive). A simple section is `section → units`. A complex one is `section → subsection → units`, and deeper where justified.

## Directory Layout

```
model/
├── papers/
│   └── {paper-slug}/
│       ├── INDEX.md                      ← paper meta + section_order + thesis
│       ├── sections/
│       │   ├── INDEX.md                  ← ordered list of sections
│       │   ├── introduction/
│       │   │   ├── INDEX.md              ← section idea + child_order + cross-links
│       │   │   ├── problem/              ← unit (leaf)
│       │   │   │   ├── INDEX.md          ← idea (comment) + status + links
│       │   │   │   └── draft.md          ← generated editable text
│       │   │   ├── gap/
│       │   │   │   ├── INDEX.md
│       │   │   │   └── draft.md
│       │   │   └── contribution/
│       │   │       ├── INDEX.md
│       │   │       └── draft.md
│       │   ├── methods/
│       │   │   ├── INDEX.md
│       │   │   ├── cell-culture/         ← subsection (container)
│       │   │   │   ├── INDEX.md          ← subsection idea + child_order
│       │   │   │   ├── seeding/          ← unit
│       │   │   │   │   ├── INDEX.md
│       │   │   │   │   └── draft.md
│       │   │   │   └── imaging/
│       │   │   │       ├── INDEX.md
│       │   │   │       └── draft.md
│       │   │   └── analysis/ …
│       │   ├── results/ …
│       │   ├── discussion/ …
│       │   ├── conclusion/ …
│       │   └── supporting-information/ …
│       └── notes/
│           ├── literature/   ← annotated bibliography entries
│           ├── data/         ← links to figures, stats, CSV summaries
│           └── feedback/     ← imported Overleaf comments, reviewer notes
├── templates/
│   ├── nature.md  ├── cell.md  └── plos-one.md   ← section_order presets per journal
└── shared/
    ├── abbreviations.md  ├── authors.md  └── bibliography.md
```

This replaces the earlier flat `outlines/ drafts/ final/`. The draft→approved→final lifecycle is now a per-unit `status` flag, not separate directories.

## Frontmatter Schemas

**Paper `INDEX.md`:**
```yaml
title: "ML Cell Counting Reproducibility Study"
journal: "PLOS ONE"
status: "Drafting"          # Planning|Drafting|Reviewing|Submitted|Published
authors: ["Ilya Yakavets"]
target_words: 5000
thesis: "LiveCount makes cell viability counting reproducible across operators."
section_order: ["introduction","methods","results","discussion","conclusion","supporting-information"]
overleaf_repo_path: null
last_export: null
```

**Container `INDEX.md`** (section / subsection):
```yaml
kind: section              # section | subsection
title: "Introduction"
target_words: 800
child_order: ["problem","gap","contribution"]
links: ["[[../discussion]]", "[[../results]]"]   # section-level cross-links
```
Body = the section's idea/narrative arc (human-authored or AI-expanded).

**Unit `INDEX.md`** (leaf paragraph):
```yaml
kind: unit
title: "Problem"
status: outline            # outline | drafted | approved
links:                     # cross-branch semantic links (→ graph edges)
  - "[[../../discussion/addresses-problem]]"
  - "[[../../../notes/literature/hemocytometer-1962]]"
citations_required: ["hemocytometer-1962"]
target_words: 120
```
Body = the **idea / comment**: the main point this paragraph must make, what evidence to use, tone. This is what the AI reads to generate `draft.md`.

**`draft.md`** (the prose): plain Markdown, editable. Optional minimal frontmatter (`words:` auto-updated). Status lives in the unit `INDEX.md`, not here.

## Comments on Any File (both idea and text)

Per the decision, comments attach to **any** `.md` — both the `INDEX.md` (idea) and the `draft.md` (text). Stored in a sidecar that never pollutes content:

```
model/papers/{slug}/sections/.comments/{relative-path}.comments.json
```
```json
[
  { "id": "c1", "file": "sections/introduction/problem/draft.md", "line": 3,
    "author": "Ilya Yakavets", "text": "Tighten this to one sentence.",
    "resolved": false, "created_at": "2026-06-15T10:22:00Z" }
]
```
Comments on the **idea** (`INDEX.md`) steer generation; comments on the **text** (`draft.md`) steer revision. Both feed the F4 revise action. Full comment API in [[phase-5-collaboration]]; the data model is fixed here so it is honored from the start.

## Cross-Branch Links

Wikilinks in any node's `links:` (and inline in body) create graph edges ([[PRD]] F3). The patterns you asked for:

- **Intro outline ↔ results & discussion:** `introduction/INDEX.md` links `[[../results]]`, `[[../discussion]]`.
- **Problem ↔ its resolution:** `introduction/problem/INDEX.md` links `[[../../discussion/addresses-problem]]`; that discussion unit links back `[[../../introduction/problem]]`.
- **Claim ↔ evidence:** `introduction/contribution` links `[[../../results/primary-finding]]`.

The graph renders these as dashed cross-branch edges, so an author (or AI) can see that every stated problem has an addressing unit, every claim has backing results. A lint can later flag unmatched links (a problem with no resolution).

## Build the Full Paper

Assembly is an ordered depth-first walk:
```
paper INDEX.section_order
  → for each section, container INDEX.child_order
    → recurse containers; at each unit, take draft.md
```
Heading level = tree depth (section = H1/\section, subsection = H2, …). Export includes units with `status: approved` by default; `--include-drafts` includes all. Then pandoc → LaTeX ([[PRD]] F6).

## Creating Structure from the UI

All node creation is from the UI (no manual file ops needed). Built on [[PRD]] F2 endpoints:

- **New paper** → scaffold from `templates/{journal}.md` (paper INDEX + `sections/` with the journal's standard sections incl. Supporting Information, each an empty container).
- **New section** → create `sections/{name}/` container (INDEX skeleton) + append to paper `section_order`.
- **New subsection / sub-subsection** → create `{parent}/{name}/` container + append to parent `child_order`. Recursive — available at any container node.
- **New unit** → create `{parent}/{name}/` with `INDEX.md` (idea skeleton, `status: outline`) + empty `draft.md` + append to parent `child_order`.
- **Convert** → a unit gains children (becomes a container that still has its own draft) or a container gets its first unit — both are just "New unit/subsection under here."

Each create updates the parent `INDEX.md` `child_order` so order is explicit and reorderable (drag in sidebar). See [[PRD]] F2/F5 for endpoint and UI detail.

## Status Dashboard

Papers view lists each paper with: journal, status, units by status (e.g. `12 approved / 18 drafted / 4 outline`), last export. Drilling into a section shows the same roll-up per section, so you see where drafting is behind.
