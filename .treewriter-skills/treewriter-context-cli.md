---
name: treewriter-context-cli
description: On-demand manuscript lookup for AI dispatch. Use when prefetched context is insufficient — search, read files, browse subtree, or fetch composed section views via the TreeWriter context CLI (no MCP required).
---

# TreeWriter context CLI

Dispatch prompts already include curated context (outline, draft, links, literature, sibling units, related FTS hits). **Do not re-fetch what is already in the prompt.**

When you need **more** manuscript context, use the CLI below instead of guessing paths or loading the whole repo.

## When to use

| Need | Command |
|------|---------|
| Keyword / cross-section discovery in one paper | `search` |
| Full file contents | `read` |
| Folder structure / section names | `tree` |
| Stitched section outline + draft | `compose` |

## How to run

From **repo root** or **`model/`** (dispatch terminal cwd is usually `model/`):

```bash
node ../scripts/tw-context.mjs search "viability assay" --root papers/{slug}
node ../scripts/tw-context.mjs read papers/{slug}/introduction/problem/draft.md
node ../scripts/tw-context.mjs tree papers/{slug} --depth 1
node ../scripts/tw-context.mjs compose papers/{slug}/sections/introduction
```

Optional flags:

- `--limit N` — cap search hits (default 20)
- `--depth N` — tree depth (omit for full subtree)
- `--approved` — compose using approved drafts only
- `--json` — machine-readable output
- `--api URL` — backend base (default `http://localhost:4000`)

## Backend vs offline

| Command | Needs backend? |
|---------|----------------|
| `read` | No — reads `model/` directly |
| `tree` | Optional — falls back to directory walk |
| `search` | Optional — uses FTS index via API; falls back to grep |
| `compose` | Yes — calls `/api/model/section-compose` |

Keep the TreeWriter dev server running (`pnpm dev`) when using `search` or `compose` for best results.

## Scope discipline

1. Always pass `--root papers/{slug}` for search when working on one paper.
2. Read only paths you need; avoid dumping entire papers.
3. Prefer `read` on specific `outline.md` / `draft.md` over broad search when you know the target.
4. Never edit files outside the dispatch output path unless the task explicitly requires it.

## Relationship to other dispatch skills

- **`treewriter-structure-and-assets.md`** — repo layout, markup, asset rules (always apply).
- **This skill** — how to **fetch** extra context on demand.
- **Writing / deslop skills** — prose quality rules.

No project MCP server is required; this CLI keeps context cost pay-as-you-go.
