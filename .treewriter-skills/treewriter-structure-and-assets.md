---
name: treewriter-structure-and-assets
description: Default TreeWriter repo guide for AI dispatch. Use for any task that reads, writes, imports, or exports manuscript content — structure, draft markup, figures, tables, equations, literature references, and export rules.
---

# TreeWriter Repository Guide for AI Agents

This skill describes how the TreeWriter manuscript repo is organized and how to reference assets correctly. Follow it together with the **MANUSCRIPT MARKUP** block appended to draft/revise tasks.

---

## Source of truth

- All manuscript content lives under `model/`.
- Each **paper** is `model/papers/{paper-slug}/`.
- Git is the canonical store; export bundles go to `.treewriter-exports/` (generated, not edited by hand).

---

## Tree structure (containers and units)

The paper is a **recursive folder tree**. Two roles:

| Role | Has `draft.md`? | Purpose |
|------|-----------------|--------|
| **Container** (paper, section, subsection) | No | Groups children; holds ordering metadata |
| **Unit** (paragraph) | Yes | One manuscript paragraph |

Every node folder uses up to **three coordinated files**:

| File | Who reads it | What belongs here |
|------|--------------|-------------------|
| **`INDEX.md`** | System / export / graph | YAML frontmatter only: `kind`, `title`, `status`, `child_order` / `section_order`, `links`. Do **not** put paragraph ideas or manuscript prose in the body. |
| **`outline.md`** | Authors & AI dispatch | What this node must say — overview bullets, narrative arc, child link list. Steers drafting and revision. |
| **`draft.md`** | Export & readers | **Manuscript text only** (units, figure captions, table bodies). This is what assembles into the published document. |

Typical layout:

```
model/papers/{slug}/
├── INDEX.md                 # paper metadata, section_order
├── outline.md               # paper-level overview
├── sections/                # or nested section folders under the paper root
│   └── introduction/
│       ├── INDEX.md         # child_order, cross-links
│       ├── outline.md
│       └── {unit-name}/     # leaf paragraph unit
│           ├── INDEX.md     # status, links
│           ├── outline.md
│           └── draft.md
├── figures/{name}/          # figure units
├── tables/{name}/           # table units
├── equations/{name}/        # equation units
└── notes/
    ├── literature/          # one .md per reference (cite_key)
    ├── data/                # datasets, supplementary notes
    └── feedback/            # imported reviewer / Overleaf todos
```

**Ordering:** export walks `section_order` (paper) and `child_order` (containers). Never rely on filesystem sort order.

**Unit status:** `outline` → `drafted` → `approved`. Only change `status` in unit `INDEX.md` frontmatter.

---

## What to edit for each task

| Task | Primary target | Avoid |
|------|----------------|-------|
| Draft / revise paragraph | `{unit}/draft.md` | Rewriting `INDEX.md` body |
| Update unit brief | `{unit}/outline.md` | Long prose in `INDEX.md` |
| Section overview | `{section}/outline.md` | Pasting full child drafts |
| Figure caption | `{figure}/draft.md` | Raw LaTeX `\begin{figure}` in unit drafts |
| Metadata / links | `INDEX.md` frontmatter | Narrative in INDEX body |

When dispatch context lists **REFERENCES** or **CITED ASSETS**, use only those entries — do not invent uncited figures, tables, or cite keys.

---

## Manuscript markup in `draft.md`

TreeWriter uses **Pandoc-oriented markdown**, not LaTeX shortcuts.

### Citations (literature)

- Location: `papers/{slug}/notes/literature/{file}.md` with frontmatter `type: literature` and `cite_key: …`.
- In `draft.md`, cite with Pandoc syntax:
  - Single: `[@smith2024]`
  - Multiple: `[@smith2024; @jones2020]` (semicolon + space; each key has `@`)
- **Do not** use `\cite{…}` in `draft.md`. Convert any `\cite{…}` you find to `[@…]`.
- Use only `cite_key` values that exist in `notes/literature/`. Export builds `references.bib` from cited keys; missing keys are reported after export.

### Figures

- Asset folder: `papers/{slug}/figures/{name}/` (`kind: figure` in `INDEX.md`; caption in `draft.md`; image or Mermaid source alongside).
- **Block embed** (figure on its own line):

```
::figure[papers/{slug}/figures/{name}]
```

- **In-text cross-reference** (inside a sentence):

```
[[papers/{slug}/figures/{name}|Figure 1]]
```

- Paths always start with `papers/…` relative to `model/`.
- Prefer block embeds for full figures; use wikilinks when referring in running text.

### Equations

- Folder: `papers/{slug}/equations/{name}/`.
- **Block embed** (own line):

```
::equation[papers/{slug}/equations/{name}]
```

- **In-text reference:**

```
[[papers/{slug}/equations/{name}|Eq. (1)]]
```

### Tables

- Folder: `papers/{slug}/tables/{name}/` (table content usually in unit `draft.md`).
- **Block table** (own line — expands to a float on export):

```
[[papers/{slug}/tables/{name}|Table caption text]]
```

- **In-text reference:**

```
[[papers/{slug}/tables/{name}|Table 1]]
```

### Editor shortcuts (draft.md only — never leave these in saved text)

`\cite{}`, `\fig{}`, `\table{}`, `\eq{}` are autocomplete helpers in the UI. Replace with `[@…]`, `::figure[…]`, wikilinks, or `::equation[…]` before finishing.

---

## Import rules

| Source | Destination | Notes |
|--------|-------------|-------|
| **BibTeX** (`.bib`) | `papers/{slug}/notes/literature/*.md` | One markdown note per entry; preserves `cite_key`. Import via the References UI or `POST /api/model/references/import`. |
| **Figure image** | `papers/{slug}/figures/{name}/` | Upload attaches preview/source files to the figure unit; reference in draft via `::figure[…]`. |
| **Overleaf `\todo` / `TODO` comments** | `papers/{slug}/notes/feedback/*.md` | Pulled from the connected Overleaf Git clone; for author triage, not export body text. |
| **Git sync** | Whole repo | Optional periodic pull/push of the TreeWriter repo (separate from Overleaf push). |

After importing references, cite them with `[@cite_key]` matching the note frontmatter exactly.

---

## Export rules

Export composes the paper from unit `draft.md` files (depth-first by `section_order` / `child_order`), expands embeds, and runs Pandoc → LaTeX/PDF.

| Setting | Effect |
|---------|--------|
| **Default** | Only units with `status: approved` are included. |
| **Include non-approved drafts** | Also exports `drafted` / `outline` units; may fall back to `outline.md` when `draft.md` is empty. |
| **Modular export** | Writes `main.tex`, `sections/*.tex`, `references.bib`, and copies figure assets into the bundle. |
| **Push to Overleaf** | Commits the modular bundle to the paper's linked Overleaf Git project. |
| **Auto-export** | Debounced export after edits when enabled in `.treewriter.json` → `export`. |

Export behavior agents should respect:

1. **Write exportable content in `draft.md`**, not in `outline.md`, unless explicitly updating a brief.
2. **Approve units** (`status: approved`) when text is ready for collaborators / Overleaf.
3. **Fix missing citations** before final push — export lists `[@keys]` with no matching literature note.
4. **Section `outline.md` files** may appear in export as LaTeX planning-note blocks when drafts are included; they are not substitutes for unit drafts.
5. Embeds (`::figure`, `::equation`, table wikilinks) must use **valid asset paths** under the same paper slug.

Output directory pattern: `.treewriter-exports/{paper-slug}-{timestamp}/`.

---

## Cross-links between sections

Unit / container `INDEX.md` `links:` array holds wikilink targets to other nodes (e.g. problem ↔ discussion). Use these for narrative coherence; they do not replace proper citations or asset embeds.

---

## Quick checklist before saving `draft.md`

- [ ] Prose is in `draft.md`; ideas stay in `outline.md`.
- [ ] Citations are `[@cite_key]` with keys from `notes/literature/`.
- [ ] Figures: `::figure[papers/…/figures/…]` or `[[…|Figure N]]`.
- [ ] Tables: `[[papers/…/tables/…|…]]`.
- [ ] Equations: `::equation[papers/…/equations/…]` or wikilink ref.
- [ ] No raw `\cite{}`, `\fig{}`, `\table{}`, `\eq{}`.
- [ ] Asset paths start with `papers/{slug}/…`.

---

## Need more context during dispatch?

Prefetched context may not cover everything. Use the **context CLI** skill (`treewriter-context-cli.md`):

```bash
node ../scripts/tw-context.mjs search "keywords" --root papers/{slug}
node ../scripts/tw-context.mjs read papers/{slug}/…/draft.md
```

Do not load the whole paper — scope `search` to one paper and `read` only what you need.
