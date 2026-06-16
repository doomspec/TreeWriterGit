---
title: Phase 2 — Scientific Paper Model
summary: Recursive section→unit tree where each paragraph unit is a folder with an idea (INDEX.md) and editable generated text (draft.md); comments attach to any file; sections/units are created from the UI.
composed_at_commit: null
---

# Phase 2 — Scientific Paper Model

This is the canonical structure reference. Every folder is a tree node with **`INDEX.md`** (technical metadata, hidden in UI), **`outline.md`** (author-facing overview), and optionally **`draft.md`** (manuscript prose for units).

## Core Idea

A paper is a **recursive tree of folders**. Two node roles (same mechanism, distinguished by whether a `draft.md` is present):

- **Container node** (paper, section, subsection): `INDEX.md` holds `child_order`, `links`, and status metadata; **`outline.md`** holds the section overview and child link list; no draft.
- **Unit node** (paragraph): `INDEX.md` holds `status` and cross-links; **`outline.md`** holds what the paragraph must say; **`draft.md`** holds the manuscript text composed into the paper.

Containers nest to whatever depth a section needs (flexible/recursive). A simple section is `section → units`. A complex one is `section → subsection → units`, and deeper where justified.

## Directory Layout

```
model/
├── papers/
│   └── {paper-slug}/
│       ├── INDEX.md                      ← paper meta (technical)
│       ├── outline.md                    ← paper summary + section links
│       ├── sections/
│       │   ├── INDEX.md                  ← section_order, links (technical)
│       │   ├── outline.md                ← section overview
│       │   ├── introduction/
│       │   │   ├── INDEX.md              ← child_order, links (technical)
│       │   │   ├── outline.md            ← section overview + child links
│       │   │   ├── problem/              ← unit (leaf)
│       │   │   │   ├── INDEX.md          ← status + links (technical)
│       │   │   │   ├── outline.md        ← paragraph overview
│       │   │   │   └── draft.md          ← manuscript text
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

**Paper `INDEX.md`:** technical metadata only (`section_order`, `thesis`, authors, journal, `composed_at_commit`, …). Overview text lives in **`outline.md`**.

**Container `outline.md`:**
```yaml
# Introduction

## Summary
Narrative arc for this section.

## Outline
* [Problem](problem/INDEX.md)
```

**Unit `outline.md`:** paragraph overview (what to say, evidence, tone).

**Unit `INDEX.md`:** `kind: unit`, `status`, `links` (graph edges), optional `citations_required`, `target_words`.

**`draft.md`:** manuscript paragraph — plain Markdown, composed into the final document.

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
