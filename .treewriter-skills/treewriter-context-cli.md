---
name: treewriter-context-cli
description: TreeWriter dispatch runtime guide — how prefetched context works (don't re-fetch), terminal workspace scope, the on-demand tw-context CLI, bulk imports, and Zotero. The HOW at runtime; pair with treewriter-structure-and-assets (layout, markup, export).
---

# TreeWriter dispatch runtime

You are dispatched inside a TreeWriter manuscript repo. This skill covers the runtime — where context comes from, where you run, and how to fetch more. For folder layout, the three files (INDEX/outline/draft), markup syntax, and what-to-edit, see **treewriter-structure-and-assets**.

## Context arrives in three layers — do not re-fetch what is already in the prompt

| Layer | You get | Your job |
|-------|---------|----------|
| **1 — Prompt** | Unit `outline.md`, `draft.md`, INDEX links, cited literature/assets, checklist files | Read first; write only what the task asks |
| **2 — Auto prefetch** | Sibling unit outlines + FTS hits in the same paper | Use for tone/terminology; don't echo in output |
| **3 — On demand** | `tw-context` CLI + import scripts (below) | Only when layers 1–2 fall short |

Pay-as-you-go: no project MCP; the CLI adds context only when you invoke it.

## Terminal scope

Dispatch runs with **cwd = `model/`** (the manuscript tree). Paths in prompts are relative to `model/` (e.g. `papers/my-paper/intro/draft.md`). Read and write only under `model/` unless the task explicitly needs repo-root scripts; the Gemini CLI must stay inside `model/`. Prompt files at `model/.treewriter-prompts/{session}.txt` are read-only.

## On-demand context (`tw-context`)

When prefetched context is not enough, run from `model/` (prepend `../` to reach scripts):

```bash
node ../scripts/tw-context.mjs search "viability assay" --root papers/{slug}
node ../scripts/tw-context.mjs read papers/{slug}/introduction/problem/draft.md
node ../scripts/tw-context.mjs tree papers/{slug} --depth 1
node ../scripts/tw-context.mjs compose papers/{slug}/sections/introduction
```

From repo root, same commands via `pnpm tw-context …` (no `../`). `read` needs no backend; `tree`/`search` fall back to directory walk/grep; `compose` needs the backend (`/api/model/section-compose`). Flags: `--limit N`, `--depth N`, `--approved`, `--json`, `--api URL` (default `http://localhost:4000`). Keep `pnpm dev` running for best `search`/`compose`.

**Scope discipline:** always `--root papers/{slug}` for one paper; prefer `read` on a known path over broad search; never dump whole papers.

## Bulk import (write; run from repo root)

```bash
pnpm import-docx papers/{slug} /path/to/file.docx      # --markdown for pre-converted GFM; --no-approve to leave pending
pnpm import-references papers/{slug} /path/to/refs.bib
```

DOCX needs pandoc (`brew install pandoc`) unless `--markdown`. Destinations and mapping are in **treewriter-structure-and-assets**; UI equivalent is the Papers → Import from Word panel.

## Zotero local (only when enabled in Settings → Extensions, Zotero desktop running)

```bash
node ../scripts/tw-zotero.mjs search "viability assay" --json
node ../scripts/tw-zotero.mjs import --keys ABC123,DEF456 --json   # writes main.bib
node ../scripts/tw-zotero.mjs snippet --keys smith2020,jones2021   # prints [@key], no backend
```

Workflow: search → import by `itemKey` → cite `[@cite_key]` in the target `draft.md`.

## Providers and workflow

Providers live in `.treewriter.json` → `aiProviders` / `defaultProvider`; skills in `.treewriter-skills/*.md` enabled via `dispatchSkillsEnabled`. Dispatch flow: open unit → Dispatch tab → Preview (⌘⇧P) or Run (⌘⇧R) → review in editor → author approves for export.

## Before finishing a dispatch run

- [ ] Output is in the path named in the prompt
- [ ] No meta-commentary or preamble unless requested
- [ ] Did not re-fetch context already in the prompt
- [ ] Stayed inside `model/` for file tools (repo-root only for bulk imports)

(Markup/asset correctness — citations, embeds, no raw `\cite{}` — is checked by **treewriter-structure-and-assets**.)
