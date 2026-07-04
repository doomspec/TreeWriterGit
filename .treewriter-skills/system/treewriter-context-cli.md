---
name: treewriter-context-cli
description: TreeWriter layers runtime — prefetched context, Assistant hot commands, tw-context CLI on demand, bulk import, Zotero. Pair with treewriter-structure-and-assets for markup and layout.
tier: system
---

# TreeWriter dispatch runtime

You are dispatched inside a TreeWriter manuscript repo. **Layers** deliver context; do not re-fetch what is already in the prompt. For folder layout and **markup**, see **treewriter-structure-and-assets**.

## Context layers

| Layer | You get | Your job |
|-------|---------|----------|
| **1 — Prompt** | Action template, unit outline/draft, INDEX links, cited assets, optional checklist | Read first; write only what the task asks |
| **2 — Auto prefetch** | Sibling unit outlines + FTS hits in the same paper | Tone/terminology only; do not echo in output |
| **3 — On demand** | `tw-context` CLI + import scripts below | Only when layers 1–2 fall short |

Pay-as-you-go: no project MCP.

## Terminal scope

**cwd = `model/`**. Paths are relative to `model/` (e.g. `papers/my-paper/intro/draft.md`). Read/write only under `model/` unless bulk import needs repo root. Prompt files at `model/.treewriter-prompts/{session}.txt` are read-only.

## Assistant UI (author workflow)

Open the **Assistant** panel (header sparkle icon, right split; overlay on narrow viewports). **Hot commands** (Make draft, Revise, …) build the same prompt as dispatch — staged in the chat box unless **Auto-run** is on. **Skills:** Settings → Skills — **system** prompts (action templates + these rules) vs **your** writing rules (toggle). Paper-wide chat history: `papers/{slug}/notes/sessions/chat-*.md`.

## On-demand context (`tw-context`)

From `model/` (prepend `../`):

```bash
node ../scripts/tw-context.mjs search "keywords" --root papers/{slug}
node ../scripts/tw-context.mjs read papers/{slug}/unit/draft.md
node ../scripts/tw-context.mjs tree papers/{slug} --depth 1
node ../scripts/tw-context.mjs compose papers/{slug}/sections/intro
node ../scripts/tw-context.mjs context papers/{slug}/unit --action draft
node ../scripts/tw-context.mjs graph papers/{slug}/unit
node ../scripts/tw-context.mjs sessions papers/{slug} --kind chat
node ../scripts/tw-context.mjs health
```

From repo root: `pnpm tw-context …`. `read`/`sessions` work offline; `search`/`compose`/`context`/`graph` need `pnpm dev`. Flags: `--limit`, `--depth`, `--approved`, `--json`, `--api URL`.

**Scope:** always `--root papers/{slug}`; prefer `read` over broad search.

## Bulk import (repo root)

```bash
pnpm import-docx papers/{slug} /path/to/file.docx
pnpm import-references papers/{slug} /path/to/refs.bib
```

Mapping rules: **treewriter-structure-and-assets**.

## Zotero local (Settings → Extensions, desktop running)

```bash
node ../scripts/tw-zotero.mjs search "topic" --json
node ../scripts/tw-zotero.mjs import --keys KEY1,KEY2 --json
node ../scripts/tw-zotero.mjs snippet --keys cite_key1,cite_key2
```

## Before finishing

- [ ] Output is in the path named in the prompt
- [ ] No meta-commentary unless requested
- [ ] Did not re-fetch context already in the prompt
- [ ] Stayed inside `model/` (repo root only for bulk imports)

Markup correctness: **treewriter-structure-and-assets**.

## Security

Default bind: loopback only. For non-local use set `TREEWRITER_WS_TOKEN` and optionally `TREEWRITER_REST_AUTH=true`.
