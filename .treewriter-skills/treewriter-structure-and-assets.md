---
name: treewriter-structure-and-assets
description: TreeWriter repo reference for AI dispatch — folder layout, the three coordinated files (INDEX/outline/draft), manuscript markup (citations, figures, tables, equations), and import/export rules. The WHAT of a paper; pair with treewriter-context-cli (the HOW at runtime).
---

# TreeWriter Repository Guide

How a TreeWriter manuscript repo is organised and how to reference assets. The runtime companion — context layers, terminal scope, the `tw-context` CLI — is **treewriter-context-cli**.

All manuscript content lives under `model/`. Each paper is `model/papers/{slug}/`. Git is canonical; generated exports go to `.treewriter-exports/` (never hand-edited).

## Tree: containers and units

The paper is a recursive folder tree with two roles:

| Role | `draft.md`? | Purpose |
|------|-------------|---------|
| **Container** (paper, section, subsection) | No | Groups children; holds ordering metadata |
| **Unit** (paragraph, figure, table, equation) | Yes | One manuscript paragraph or asset |

Every node folder holds up to **three coordinated files** — the core mental model:

| File | Read by | Holds |
|------|---------|-------|
| **`INDEX.md`** | System / export / graph | YAML frontmatter only: `kind`, `title`, `status`, `child_order`/`section_order`, `links`. Never prose. |
| **`outline.md`** | Authors & dispatch | What the node must say — overview bullets, arc, child links. Steers drafting. |
| **`draft.md`** | Export & readers | Manuscript text only. This assembles into the published document. |

```
model/papers/{slug}/
├── INDEX.md                # metadata, section_order
├── outline.md
├── sections/introduction/
│   ├── INDEX.md            # child_order, links
│   ├── outline.md
│   └── {unit}/             # leaf: INDEX.md + outline.md + draft.md
├── figures/{name}/  tables/{name}/  equations/{name}/
└── notes/{literature,data,feedback}/
```

Export walks `section_order` / `child_order` — never filesystem sort. Unit `status`: `outline` → `drafted` → `approved`, changed only in unit `INDEX.md`.

## What to edit

| Task | Target | Not |
|------|--------|-----|
| Draft / revise paragraph | `{unit}/draft.md` | `INDEX.md` body |
| Update brief | `{unit}/outline.md` | Prose in `INDEX.md` |
| Section overview | `{section}/outline.md` | Full child drafts |
| Figure caption | `{figure}/draft.md` | Raw `\begin{figure}` |
| Metadata / links | `INDEX.md` frontmatter | Narrative in INDEX body |

One focused paragraph per unit unless the outline requires more. When dispatch context lists REFERENCES or CITED ASSETS, use only those — invent no uncited figures, tables, or keys.

## Manuscript markup in `draft.md`

Pandoc-oriented markdown, not LaTeX. `\cite{}`, `\fig{}`, `\table{}`, `\eq{}` are UI autocomplete helpers — replace all four before finishing.

| Asset | Block embed (own line) | In-text reference |
|-------|------------------------|-------------------|
| **Figure** `papers/{slug}/figures/{name}/` | `::figure[papers/{slug}/figures/{name}]` | `[[papers/{slug}/figures/{name}|Figure 1]]` |
| **Equation** `papers/{slug}/equations/{name}/` | `::equation[papers/{slug}/equations/{name}]` | `[[papers/{slug}/equations/{name}|Eq. (1)]]` |
| **Table** `papers/{slug}/tables/{name}/` | `[[papers/{slug}/tables/{name}|Caption text]]` | `[[papers/{slug}/tables/{name}|Table 1]]` |

Paths always start `papers/…` (relative to `model/`). Prefer block embeds for full assets, wikilinks in running text.

**Citations:** literature notes live at `papers/{slug}/notes/literature/{file}.md` (frontmatter `type: literature`, `cite_key`). Cite `[@smith2024]`, multiple `[@smith2024; @jones2020]`. Use only keys that exist there — export builds `references.bib` from cited keys and reports missing ones.

## Import / export

| Import source | Destination |
|---------------|-------------|
| BibTeX `.bib` | `notes/literature/*.md` (one note per entry, preserves `cite_key`) |
| Word `.docx` | New sections/units (`##` → section, `###`/paragraph → unit; auto-approves) |
| Figure image | `figures/{name}/` (reference via `::figure[…]`) |
| Overleaf `\todo` / `TODO` | `notes/feedback/*.md` (author triage, not export body) |

Exact commands (`import-docx`, `import-references`) are in **treewriter-context-cli**.

Export composes `draft.md` files depth-first by order, expands embeds, runs Pandoc → LaTeX/PDF into `.treewriter-exports/{slug}-{timestamp}/`. Default includes only `status: approved` units; "include drafts" also exports `drafted`/`outline` (falling back to `outline.md` when `draft.md` is empty). Modular export writes `main.tex` + `sections/*.tex` + `references.bib` + figure assets; optionally pushed to the linked Overleaf project. So: write exportable text in `draft.md` (not `outline.md`), approve when ready, fix missing `[@keys]` before push, keep embed paths valid under the same slug.

Container `INDEX.md` `links:` holds wikilinks to related nodes (problem ↔ discussion) for narrative coherence — not a substitute for citations or embeds.

## Before saving `draft.md`

- [ ] Prose in `draft.md`, ideas in `outline.md`
- [ ] Citations `[@cite_key]` from `notes/literature/`
- [ ] Figures `::figure[…]` / `[[…|Figure N]]`; tables `[[…|Table N]]`; equations `::equation[…]`
- [ ] No raw `\cite{}`, `\fig{}`, `\table{}`, `\eq{}`; asset paths start `papers/{slug}/`
