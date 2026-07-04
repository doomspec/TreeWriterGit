---
name: treewriter-structure-and-assets
description: TreeWriter markup and repo layout — INDEX/outline/draft, .approval/, citations, figures, tables, equations, import/export. Pair with treewriter-context-cli for runtime CLI.
tier: system
---

# TreeWriter repository guide

All manuscript content lives under `model/`. Each paper is `model/papers/{slug}/`. Git is canonical; exports go to `.treewriter-exports/` (never hand-edit). Runtime CLI: **treewriter-context-cli**.

## Tree: containers and units

| Role | `draft.md`? | Purpose |
|------|-------------|---------|
| **Container** (paper, section) | No | Groups children; ordering metadata |
| **Unit** (paragraph, figure, table, equation) | Yes | One paragraph or asset |

| File | Holds |
|------|-------|
| **`INDEX.md`** | YAML only: `kind`, `status`, `child_order`/`section_order`, `links` |
| **`outline.md`** | What the node must say — steers dispatch |
| **`draft.md`** | Exportable manuscript text (units only) |

Approved snapshots live in **`.approval/`** per unit: `.approval/draft.approved.md`, `.approval/outline.approved.md` (+ `.yaml` provenance). Legacy top-level `draft.approved.md` may still exist until migrated.

Unit `status`: `outline` → `drafted` → `approved` (in unit `INDEX.md`). Export walks `section_order` / `child_order`, not filesystem order.

## What to edit

| Task | Target |
|------|--------|
| Draft / revise | `{unit}/draft.md` |
| Update brief | `{unit}/outline.md` |
| Section overview | `{section}/outline.md` |
| Metadata / links | `INDEX.md` frontmatter |
| Scratchpad (not exported) | `{unit}/temp-notes.md` |

Review comments: inline `<comment id="…" author="…">text</comment>` in manuscript files (stripped on export).

Explorer mode: opening `papers/` tabs shows a confirm gate — manuscript edits belong in Writer mode.

## Markup in `draft.md`

Pandoc markdown, not LaTeX. `\cite{}`, `\fig{}`, `\table{}`, `\eq{}` are UI shortcuts only — replace before finishing.

| Asset | Block embed (own line) | In-text |
|-------|------------------------|---------|
| Figure | `::figure[papers/{slug}/figures/{name}]` | `[[papers/{slug}/figures/{name}|Figure 1]]` |
| Equation | `::equation[papers/{slug}/equations/{name}]` | `[[…|Eq. (1)]]` |
| Table | — | `[[papers/{slug}/tables/{name}|Table 1]]` |

**Citations:** `[@smith2024]`, multiple `[@a; @b]`. Keys from `papers/{slug}/notes/literature/*.md` only.

## Import / export

| Source | Destination |
|--------|---------------|
| BibTeX | `notes/literature/*.md` |
| Word `.docx` | sections/units (see **treewriter-context-cli** for commands) |
| Overleaf `\todo` | `notes/feedback/*.md` |

Export: approved `draft.md` only by default; modular `.tex` + `references.bib` + assets; optional Overleaf push (paths under `.overleaf/{slug}/`).

## Before saving `draft.md`

- [ ] Prose in `draft.md`, ideas in `outline.md`
- [ ] Citations `[@cite_key]` from literature notes
- [ ] Embeds and wikilinks use valid `papers/{slug}/…` paths
- [ ] No raw `\cite{}` / `\fig{}` / `\table{}` / `\eq{}`
