---
name: treewriter-ai-usage
description: TreeWriter AI dispatch guide. How prefetched context works, where to write, terminal workspace scope, on-demand CLI lookup, and bulk import scripts. Use on every draft/revise/import task.
---

# TreeWriter AI usage

You are working inside a TreeWriter manuscript repo. Follow this skill together with **`treewriter-structure-and-assets.md`** (markup, assets, export) and any enabled writing skills.

---

## Dispatch context — three layers

TreeWriter assembles context **before** you run. Do not re-fetch what is already in the prompt.

| Layer | What you get | Your job |
|-------|--------------|----------|
| **1 — Prompt assembly** | Unit `outline.md`, `draft.md`, INDEX links, cited literature/assets, optional checklist files | Read it first; write only what the task asks |
| **2 — Auto prefetch** | Sibling unit outlines + FTS hits in the same paper | Use for tone/terminology; do not duplicate in output |
| **3 — On demand** | `tw-context` CLI + import scripts (below) | Run only when layers 1–2 are insufficient |

**Pay-as-you-go:** no project MCP. Skills append rules to dispatch prompts only; the CLI adds context only when you invoke it.

---

## Terminal workspace scope

Dispatch runs in the integrated terminal with **cwd = `model/`** (the manuscript tree).

- Paths in prompts are relative to **`model/`** (example: `papers/my-paper/intro/draft.md`).
- **Read and write only under `model/`** unless the task explicitly requires repo-root scripts.
- **Gemini CLI:** stay inside `model/` — do not list or access the repository root.
- Prompt files live at `model/.treewriter-prompts/{session}.txt` (read-only context).

---

## What to edit

| Task | Edit | Do not |
|------|------|--------|
| Draft / revise paragraph | `{unit}/draft.md` | Put prose in `INDEX.md` or parent `outline.md` |
| Update unit brief | `{unit}/outline.md` | Replace approved export text without intent |
| Figure caption | `{figure}/draft.md` | Raw LaTeX `\begin{figure}` in unit drafts |
| Metadata / ordering | `INDEX.md` frontmatter | Narrative in INDEX body |

Units export from **`draft.md`** when `status: approved`. The author clicks **Approve** in the UI after your edit; do not skip approval semantics in comments.

One focused paragraph per unit unless the outline explicitly requires more.

---

## On-demand context CLI (`tw-context`)

When prefetched context is not enough, run from **`model/`** (prepend `../` to reach scripts):

```bash
node ../scripts/tw-context.mjs search "viability assay" --root papers/{slug}
node ../scripts/tw-context.mjs read papers/{slug}/introduction/problem/draft.md
node ../scripts/tw-context.mjs tree papers/{slug} --depth 1
node ../scripts/tw-context.mjs compose papers/{slug}/sections/introduction
```

From **repo root** (same commands, no `../`):

```bash
pnpm tw-context search "keywords" --root papers/{slug}
pnpm tw-context read papers/{slug}/section/unit/draft.md
```

| Command | Needs backend? |
|---------|------------------|
| `read` | No — reads `model/` directly |
| `tree` | Optional — falls back to directory walk |
| `search` | Optional — FTS via API; falls back to grep |
| `compose` | Yes — `/api/model/section-compose` |

Flags: `--limit N`, `--depth N`, `--approved` (compose), `--json`, `--api URL` (default `http://localhost:4000`).

Keep **`pnpm dev`** running for best `search` / `compose` results.

### Scope discipline

1. Always pass `--root papers/{slug}` when searching one paper.
2. Prefer `read` on a known `outline.md` / `draft.md` over broad search.
3. Never dump entire papers — read only paths you need.
4. Do not edit files outside the dispatch output path unless the task requires it.

---

## Bulk import scripts (write operations)

Separate from read-only `tw-context`. Run from **repo root**:

| Need | Command |
|------|---------|
| Word → sections/units | `pnpm import-docx papers/{slug} /path/to/file.docx` |
| Pre-converted GFM markdown | `pnpm import-docx papers/{slug} /path/to/file.md --markdown` |
| BibTeX → literature notes | `pnpm import-references papers/{slug} /path/to/refs.bib` |

Options: `--json` (machine-readable result), `--no-approve` on DOCX import (leave drafts pending).

**DOCX import mapping:** pandoc GFM → paper title from `#`, sections from `##`, units from `###` or paragraph splits. Requires **pandoc** (`brew install pandoc`) unless `--markdown`.

**UI alternative:** Papers sidebar → **Import from Word** panel (same backend pipeline).

After BibTeX import, cite with `[@cite_key]` matching `notes/literature/` frontmatter.

---

## Zotero local (Settings → Extensions → enabled only)

When the local Zotero extension is enabled and Zotero desktop is running:

```bash
node ../scripts/tw-zotero.mjs search "viability assay" --json
node ../scripts/tw-zotero.mjs import --keys ABC123,DEF456 --json
node ../scripts/tw-zotero.mjs snippet --keys smith2020,jones2021
```

| Command | Needs backend? |
|---------|----------------|
| `status` | Yes |
| `search` | Yes — proxies to Zotero at localhost:23119 |
| `import` | Yes — writes to `main.bib` |
| `snippet` | No — prints `[@key]` markup locally |

Workflow: search → import by `itemKey` → write `[@cite_key]` in target `draft.md` (or use `snippet` for the exact string).

---

## Providers and skills

- **Providers:** `.treewriter.json` → `aiProviders`, `defaultProvider` (Claude, Codex, Gemini, Aider, …).
- **Skills:** `.treewriter-skills/*.md`, enabled via `dispatchSkillsEnabled` — appended to each preview, not every IDE session.
- **Workflow:** open unit → Dispatch tab → Preview (⌘⇧P) or Run (⌘⇧R) → review in editor → author approves for export.

---

## Quick checklist before finishing

- [ ] Output is in the path named in the prompt (`draft.md`, `outline.md`, etc.).
- [ ] No meta-commentary or preamble unless requested.
- [ ] Citations `[@cite_key]`; figures `::figure[…]`; no raw `\cite{}` / `\fig{}`.
- [ ] Did not re-fetch context already present in the prompt.
- [ ] Stayed inside `model/` for file tools (except repo-root import scripts when bulk-importing).

---

## Related skills

- **`treewriter-structure-and-assets.md`** — tree layout, embed syntax, export rules.
- **Writing skills** — prose quality (deslop, venue patterns, etc.).
