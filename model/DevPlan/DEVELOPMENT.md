---
title: TreeWriter Development Doc (as-built + roadmap)
summary: Single source of truth for the TreeWriter scientific-writing platform as it actually exists in code, plus the verified-issue catalogue and fix roadmap. Supersedes the stale top half of architecture.md.
status: living
owner: Ilya Yakavets
composed_at_commit: b1be1f7
related: ["[[PRD]]", "[[architecture]]", "[[phase-2-paper-model]]", "[[tool-assessment]]"]
---

# TreeWriter — Development Doc

This is the **as-built** reference. Where phase docs describe *intent*, this doc describes *what the code does today*, grounded in the source. It also carries the verified-issue catalogue (§12) and the fix roadmap (§13).

> **Doc map.** [[architecture]] is the high-level system map (component diagram, data flows, ports). [[PRD]] §2 is the capability checklist. This file is the detailed as-built authority.

---

## 1. Purpose

One local app where AI writes scientific-paper Markdown and humans collaborate; LaTeX/Overleaf is the presentation layer. The Git Markdown model is the single source of truth. Authors fire any AI CLI against a specific unit from the UI; a graph view shows semantic links within and across papers; pandoc exports to `.tex`/PDF.

Non-goals (this build): auth/multi-tenant, CRDT live cursors, Quartz-as-server, vector RAG, arbitrary LaTeX round-trip. See [[tool-assessment]].

---

## 2. Tech stack

| Layer | Stack |
|-------|-------|
| Backend | Node + Express 4, TypeScript (ESM), `tsx` dev, `ws` WebSockets, `gray-matter` frontmatter, `execFile` for git/pandoc |
| Terminal | Python `pty_bridge.py` (114 lines) — real PTY, fd-3 control channel for resize |
| Frontend | React 19 + Vite 6, TypeScript, Tailwind + shadcn-style `button`, `@xterm/xterm` + `addon-fit`, `d3-force` graph, `react-markdown` + `remark-gfm` |
| Tests | `vitest` (backend temp-dir integration; frontend mocked-fetch unit) |
| Model | Git repo, Markdown + `[[wikilinks]]`, auto-sync every 120 s |

Ports: frontend `5173`, backend `4000`. (Quartz `8080` if ever built on-demand — not in dev loop.)

---

## 3. Repo layout

```
TreeWriterGit/
├── model/                      ← source of truth (Git, Markdown)
│   ├── DevPlan/                ← these docs
│   ├── papers/{slug}/          ← scientific papers (recursive tree)
│   └── templates/{journal}.md  ← per-journal section sets
├── scripts/
│   └── scaffold-roboculture.mjs← example-project generator
├── view/
│   ├── backend/src/            ← Express API + PTY + git sync
│   └── frontend/src/           ← React app
├── .treewriter.json            ← AI provider registry
├── .treewriter-exports/        ← pandoc output (gitignored)
└── .treewriter-prompt.txt      ← dispatch prompt scratch (SHOULD be gitignored — §12.21)
```

---

## 4. The model — 3-file unit tree

### 4.1 Node kinds

- **paper** — `papers/{slug}/`. Root of a manuscript.
- **container** — `section` / `subsection`. Holds ordered children. Recursive to any depth.
- **unit** — a leaf paragraph. Folder of **three files**.

### 4.2 The three files (canonical)

| File | Role | Written by | Read by |
|------|------|-----------|---------|
| `INDEX.md` | **metadata only** — frontmatter (`kind`, `title`, `status`, `links`, `child_order`/`section_order`). Body is incidental. | `createNode`, scaffold | graph, papers, export, compose (frontmatter) |
| `outline.md` | **user-facing idea / overview** — what this paragraph must say. The "comment" that steers AI. | `createNode`, lazy `materializeOutline`, `refresh-index`/`sync-outline` actions | dispatch (`readOutlineDoc`), compose (`parseOutlineSummary`) |
| `draft.md` | **manuscript text** — AI-generated, human-editable. The thing that exports. | AI dispatch, lazy `materializeDraft`, hand edits | dispatch (`revise`/`expand`), compose, export |

> **History note.** The idea used to live in `INDEX.md` *body*. It moved to `outline.md`. Readers keep an `INDEX.md`-body fallback ([agentDispatch.ts:109](../../view/backend/src/agentDispatch.ts)) — but `compose.ts` does **not** fall back, so a unit with no `outline.md` shows "No summary yet" (§12.19).

### 4.3 Frontmatter schemas

```yaml
# paper INDEX.md
kind: paper
title: "…"
slug: "…"
journal: "PLOS ONE"
status: Planning          # free-text paper status
authors: ["…"]
target_words: 5000
section_order: ["introduction", "methods", …]
overleaf_repo_path: null
last_export: null         # ISO ts, patched by export

# container INDEX.md
kind: section | subsection
title: "…"
child_order: ["problem", "contribution", …]

# unit INDEX.md
kind: unit
title: "…"
status: outline | drafted | approved   # ENUM — see §4.4
links: ["results/yeast-experiment", …] # cross-branch wikilink targets
```

### 4.4 Status enum (INVARIANT)

Units: **`outline` → `drafted` → `approved`** only. `countUnitsUnder` buckets anything else as `outline`. Export defaults to `approved`-only unless `includeDrafts`. Status auto-advances on dispatch complete (M8).

### 4.5 Ordering (INVARIANT)

Order is editorial, **separate from filesystem**. Paper uses `section_order`; containers use `child_order`. These drive export order and rendering. CRUD endpoints must keep them in sync (`patchChildOrder` in `modelFs.ts`).

### 4.6 Naming (INVARIANT)

`assertNodeName` ([modelFs.ts:37](../../view/backend/src/modelFs.ts)) — folder-safe slugs: `[a-z0-9-_]+` only (M7).

---

## 5. Backend module map (`view/backend/src/`)

| File | Responsibility | Key exports |
|------|----------------|-------------|
| `server.ts` | Express app, 23 routes, 2 WS servers, git-sync loop, `fs.watch` broadcast, PTY spawn | — |
| `modelFs.ts` | File CRUD + node create/delete/move/reorder; `child_order` maintenance; path safety; lazy file materialization | `resolveModelPath`, `createNode`, `deleteNode`, `moveNode`, `reorderChildren`, `createFile`, `materializeOutline`, `materializeDraft`, `indexSkeleton`, `outlineDocSkeleton`, `ModelFsError` |
| `agentDispatch.ts` | AI provider config + prompt builder + shell-command builder | `loadProviders`, `buildPreview`, `DispatchAction` |
| `sessions.ts` | Dispatch-session ledger under `{unit}/.sessions/{stamp}.md` | `listSessions`, `createSession`, `updateSessionStatus` |
| `compose.ts` | Build composed section views (stitched child summaries + drafts) for read | `composeSectionView`, `parseOutlineSummary`, `displayChildTitle` |
| `export.ts` | Depth-first `draft.md` assembly → pandoc → `.tex`/PDF; `.bib` from lit notes; PDF-engine fallback | `exportPaper`, `buildCombinedMarkdown`, `buildBibliography`, `extractCiteKeys`, `detectPdfEngine`, `resolveExportDownload` |
| `papers.ts` | Paper scaffold from journal template; list + per-status roll-up | `scaffoldPaper`, `listPapers`, `getPaperDetail`, `loadJournalTemplate`, `listJournalTemplates`, `slugify` |
| `graph.ts` | Walk `.md`, parse wikilinks from INDEX `links:` + `## Outline` section; structural `child_order` edges; resolve targets; emit nodes/edges + `missing:` nodes | `buildGraph`, `parseWikilinks`, `parseOutlineContentLinks`, `parseChildOrder`, `resolveTarget` |
| `pty_bridge.py` | Fork real PTY for the shell; relay stdin/stdout; fd-3 JSON control channel → `set_winsize` + `SIGWINCH` | — |

**Invariants devs must respect**
- **Never mutate `parsed.data`** from gray-matter (cache aliasing) — always spread into a fresh object (`patchChildOrder` does this).
- **Always `resolveModelPath`** any client-supplied path before touching the FS. (Currently missed in preview/compose/sessions — §12.5/§12.6.)
- **Broadcast `model-changed`** after every mutation so all clients reload.

---

## 6. API reference (23 routes, all live)

| Method | Path | Body / Query | Purpose |
|--------|------|--------------|---------|
| GET | `/health` | — | status + gitSync |
| GET | `/api/model/tree` | — | full model tree |
| GET | `/api/model/file` | `?path=` | read file |
| PUT | `/api/model/file` | `{path, content}` | overwrite file (autosave) |
| POST | `/api/model/file` | `{path, content?}` | create file (409 if exists) |
| POST | `/api/model/node` | `{parent, name, kind}` | create section/subsection/unit |
| DELETE | `/api/model/file` | `?path=&recursive=` | delete node |
| POST | `/api/model/move` | `{from, to}` | rename/move |
| POST | `/api/model/reorder` | `{parent, child_order[]}` | rewrite order |
| GET | `/api/model/graph` | `?root=` | wikilink graph |
| GET | `/api/model/section-compose` | `?path=` | stitched section outline+draft |
| GET | `/api/agent/providers` | — | AI provider registry |
| POST | `/api/agent/preview` | `{unitPath, action, provider, customPrompt?}` | build prompt + shell command (no exec) |
| GET | `/api/sessions` | `?unitPath=` | list dispatch sessions for unit |
| POST | `/api/sessions` | `{unitPath, provider, action, command, status?, notes?}` | record session |
| PATCH | `/api/sessions` | `{unitPath, filename, status, notes?}` | update session status |
| GET | `/api/git-sync/status` | — | sync state |
| POST | `/api/git-sync/run` | — | force sync |
| GET | `/api/paper/templates` | — | journal names |
| GET | `/api/papers` | `?slug=` | list, or one detail w/ section roll-up |
| POST | `/api/paper` | `{title, journal, authors, slug?}` | scaffold paper |
| POST | `/api/export` | `{paperSlug, format, includeDrafts?}` | pandoc export |
| GET | `/api/export/download` | `?file=` | download export artifact |

Errors: thrown `ModelFsError` carries an HTTP status (400/404/409/503); final handler maps it ([server.ts:585](../../view/backend/src/server.ts)).

---

## 7. WebSocket + terminal

Two channels, both upgraded on the same HTTP server ([server.ts:627](../../view/backend/src/server.ts)):

- **`/terminal`** — spawns `python3 pty_bridge.py <modelRoot> <shell> …` with `stdio:["pipe","pipe","pipe","pipe"]`. fd-3 = control channel. Client msgs: `{type:"input",data}` → stdin; `{type:"resize",cols,rows}` → fd-3 JSON → `set_winsize(master)` + `SIGWINCH`. Terminal cwd = `modelRoot`.
- **`/model-events`** — server pushes `{type:"model-changed",path}` on every mutation and on debounced `fs.watch` (100 ms). Frontend debounces 150 ms then reloads tree + git status + bumps `refreshVersion`.

---

## 8. Frontend component map (`view/frontend/src/`)

```
App.tsx                        ← root: state, nav, terminal lifecycle, WS, git sync
├── components/layout/
│   ├── Sidebar.tsx            ← tabs: Explorer / Papers / Graph + search
│   ├── Breadcrumbs.tsx        ← path nav
│   └── RightPanel.tsx         ← AI dispatch + terminal host (collapsible)
├── components/editor/
│   ├── EditorWorkspace.tsx    ← unit editor (outline.md + draft.md dual-pane)
│   ├── SectionWorkspace.tsx   ← composed section view (calls /section-compose)
│   ├── MarkdownEditor.tsx     ← textarea + autosave (PUT, debounced); compact pane mode
│   └── MarkdownViewer.tsx     ← react-markdown; wikilink preprocess; in-app nav links
├── components/nav/
│   ├── FolderBrowse.tsx       ← card grid for non-paper / generic folders
│   └── OutlineList.tsx        ← outline link list
├── DispatchPanel.tsx          ← provider/action selectors, preview, run-to-terminal, session history
├── GraphPanel.tsx             ← d3-force SVG graph (outline vs contains edge styles)
├── PapersPanel.tsx            ← paper select, roll-up, export, drag-reorder, nested subsections
├── NewPaperModal.tsx          ← scaffold form
├── lib/modelTree.ts           ← tree/path/frontmatter/outline helpers; isUnitFolder, isSectionContainer
├── lib/graphLocal.ts          ← local-neighbourhood graph helpers
└── modelApi.ts                ← typed fetch client (ApiError) for all endpoints
```

### Center-panel routing (`App.tsx`)

The workspace picks one of three center views based on the current folder node:

| Condition | Component | What user sees |
|-----------|-----------|----------------|
| Leaf unit (`isUnitFolder` — has `outline.md`/`draft.md`, no child dirs) | `EditorWorkspace` | Side-by-side outline + draft editors |
| Paper section container under `papers/` (`isSectionContainer`, no `activeFile`) | `SectionWorkspace` | Composed outline + draft from `/api/model/section-compose` |
| Everything else (explorer roots, Philosophy, etc.) | `FolderBrowse` | INDEX hero + child cards + outline pills |

`isUnitFolder` / `isSectionContainer` live in [modelTree.ts](../../view/frontend/src/lib/modelTree.ts). Units are detected by **absence of child directories**, not INDEX `kind` (backend compose/export use `kind`).

### Markdown rendering notes

- `MarkdownViewer` converts `[[wikilinks]]` to markdown links, resolves targets via `resolveNavigateTarget`, and navigates in-app with `<a>` + `preventDefault` (not `<button>` inside headings).
- Dual-pane reading uses `.markdown-pane` CSS — full column width, heading padding, `break-word` (see [index.css](../../view/frontend/src/index.css)).

Layout: CSS grid `workspace-grid` (sidebar | workspace | right-panel); right panel collapses via `--agent-collapsed` modifier.

---

## 9. Key data flows

### 9.1 AI dispatch loop (core value prop)
1. User navigates to a unit → `currentPath` set → DispatchPanel shows it.
2. User picks provider (`.treewriter.json`) + action (draft / revise / expand / cite-check / refresh-index / sync-outline / custom).
3. **Preview** → `POST /api/agent/preview` → `buildPreview` reads `outline.md` (idea) + `draft.md` (if revise/expand/cite-check) + up to 5 linked units' context, fills the action template, writes prompt to `.treewriter-prompt.txt`, returns `{prompt, command, outputPath}`. The command references the prompt via `"$(cat ../.treewriter-prompt.txt)"`.
4. **Run** → command written to `/terminal` WS as `{type:"input"}`. User watches the AI run live. AI writes `draft.md` (or stdout redirect for `writesFiles:false` providers).
5. Session recorded (`POST /api/sessions`, status `dispatched`). `fs.watch` → `model-changed` → card refreshes.
6. User marks session **complete** / **skipped** (manual today — §12.11). Status flag on the *unit* does NOT auto-advance (§12.3).

### 9.2 Session storage
`{unit}/.sessions/{ISO-stamp}.md`, frontmatter `{at, provider, action, command, status, notes?}`. Avoids re-running the same AI work; surfaces unresolved `dispatched` sessions as a warning.

### 9.3 Compose (read section as one doc)
`composeSectionView` walks `child_order` (+ on-disk extras). For each child:

- **`displayChildTitle`** — uses `titleCase(folderName)` when INDEX `title` is missing or equals the slug (e.g. `background` → `Background`).
- **Outline pane** — plain `### Title` heading, separate `[Open Title →](child/INDEX.md)` drill-down link, then `parseOutlineSummary` from child's `outline.md` (no INDEX-body fallback).
- **Draft pane** — plain `## Title` heading + drill-down link + stitched child `draft.md` bodies (recursive for nested sections).

`SectionWorkspace` fetches `GET /api/model/section-compose?path=` and renders both panes via `MarkdownViewer` with clickable links.

### 9.4 Export
`buildCombinedMarkdown` depth-first walks `section_order` → `child_order`, takes each unit's `draft.md` (approved-only unless `includeDrafts`), heading level = depth. `extractCiteKeys` → `buildBibliography` from `notes/literature/*`. `pandoc --citeproc` → `.tex`/PDF. PDF engine auto-detected (`tectonic`→`xelatex`→`pdflatex`→`lualatex`); falls back to `.tex` with a notice if none. `last_export` patched into paper INDEX.

### 9.5 Git sync
Every 120 s (and on demand): detect branch → `fetch origin` → if `model/` dirty, `add model` + commit "Automated sync" → if `origin/{branch}` exists, `rebase` (abort + set `conflictDetected` on failure) → `push HEAD:{branch}`.

### 9.6 Graph
`buildGraph` walks `.md` under root and emits two edge kinds:

- **`outline` (semantic)** — from INDEX frontmatter `links:` + wikilinks/markdown links in the `## Outline` section of `outline.md` (full-body wikilinks only for legacy folders without `## Outline`). Draft `draft.md` wikilinks are excluded.
- **`contains` (structural)** — parent → child from `child_order` / `section_order`.

Resolution: exact path → unique basename → `missing:` node. Folder `INDEX`/`outline`/`draft` fold into one node id (the directory path). `GraphPanel` pre-settles force ticks, color-by-type, solid primary lines for `outline` edges, dashed gray for `contains`, 1-hop hover highlight, click→navigate.

---

## 10. Conventions / invariants checklist

- [ ] New client-path endpoint? → `resolveModelPath` first.
- [ ] Mutating frontmatter? → spread into fresh object, never mutate `parsed.data`.
- [ ] New mutation? → `broadcastModelEvent` after.
- [ ] New unit-detection / child-walk? → use the shared helper (once unified — §12.1/§12.2), not a private copy.
- [ ] Unit status writes? → only `outline|drafted|approved`.
- [ ] New node name from user? → `assertNodeName` (tighten first — §12.5).

---

## 11. Tests

**Backend (vitest, temp dirs):** `agentDispatch`, `compose`, `export`, `graph`, `modelFs`. **Frontend:** `modelApi`, `lib/modelTree`, `lib/graphLocal`.

**Gaps (high-value to add):**
- `sessions.ts` — incl. a path-traversal rejection test (§12.6).
- `papers.ts` — `countUnitsUnder` status bucketing (would catch §12.19) + `scaffoldPaper`.
- `server.ts` routes — no supertest harness; add one for preview/sessions/paper/export.
- Frontend components (App/DispatchPanel/PapersPanel/GraphPanel/NewPaperModal) untested.

Run: `pnpm test` in each of `view/backend` and `view/frontend`. Typecheck: `pnpm exec tsc --noEmit`.

---

## 12. Verified-issue catalogue

Severity scoped to **localhost single-user**. Items fixed in M7–M11 and polish passes are marked **(fixed)**.

### Backend correctness (fixed M7)
- **12.1 (fixed)** Unit-detection diverged → shared `isUnitDir` in `modelFs.ts`.
- **12.2 (fixed)** Child-walk diverged → shared `orderedChildren`.
- **12.3 (fixed)** Unit status auto-advances on session complete.
- **12.4 (fixed)** Per-session prompt files in `.treewriter-prompts/`.

### Security (fixed M7; revisit before exposure)
- **12.5 (fixed)** Path validation + `assertNodeName` + shell-quote on preview output.
- **12.6 (fixed)** `resolveModelPath` on compose/sessions; basename session filenames.
- **12.7 (fixed)** CORS locked to `http://localhost:5173`.
- **12.8 (open)** `.treewriter.json` provider command unvalidated (trusted repos only).
- **12.9 (low/open)** `resolveExportDownload` prefix check — neutralized by basename.

### UI (mostly fixed M8–M10)
- **12.10 (fixed)** Inline CRUD via `NamePromptDialog` / `ConfirmDialog`.
- **12.11 (fixed)** Auto-mark sessions complete on post-dispatch `model-changed`.
- **12.12 (fixed)** Dispatch command `<textarea>`.
- **12.13 (fixed)** Graph zoom/pan + keyboard node focus.
- **12.14 (open)** `NewPaperModal` a11y (focus trap, Escape).
- **12.15 (open)** Error toast: no `aria-live`, auto-dismiss, stacking.
- **12.16 (fixed)** Resizable dual-pane + workspace persistence.
- **12.17 (open)** No loading skeletons.

### Docs / devex
- **12.19 (fixed)** Scaffold script emits `outline.md`, `status:"drafted"`.
- **12.20 (open)** Test gaps — see §11 (frontend components, supertest routes).
- **12.21 (partial)** Graph cache done; `.treewriter-prompt.txt` gitignored; no CI gate yet.

### Recently fixed
- **12.18 (fixed)** Architecture doc + PRD API table (M-docs).
- **12.22 (fixed)** Section workspace heading clip (M6.5).
- **F4/F6 polish (fixed)** Context checklist, shortcuts, fan-out; CSL lookup, approved-only export, batch export.

---

## 13. Roadmap

> **Roadmap M1–M11 + M-docs + F4/F6 polish complete.** Remaining: test gaps (§11), optional roboculture metadata, server-side agent jobs (F4 v1.1).

| Milestone | Scope | Status |
|-----------|-------|--------|
| M1–M5 | Terminal, git sync, CRUD, graph, AI dispatch, paper model | **done** |
| M6 | Export v1 — pandoc `.tex`/`.pdf`, PDF→`.tex` fallback | **done** |
| **M6.5 — Section authoring** | `section-compose` API, `SectionWorkspace`, graph `outline`/`contains` edges, clickable nav links, heading-clip fix (§12.22) | **done** |
| **M7 — Hardening** | Path safety, scaffold fix, per-session prompts, unified `isUnitDir`/`orderedChildren`, hardening tests | **done** |
| **M8 — Authoring UX** | Resizable split, `localStorage` workspace prefs, inline CRUD, dispatch textarea, status auto-advance, CORS | **done** |
| **M9 — Export + Overleaf v1.1** | Duplicate-heading skip, cite warnings, CSL/bib from literature notes, Overleaf push | **done** |
| **M10 — Navigation polish** | Search API (F2), graph zoom/pan/cache, subsection reorder | **done** |
| **M11 — Collab** | Comments sidecar, Overleaf round-trip, presence | **done** |
| **M-docs** | Rewrite [[architecture]], sync [[PRD]] §2/§4 | **done** |

### M7 — Hardening (~2–3 days)

Backend + correctness only. No UI redesign.

1. **Path safety** — `resolveModelPath` in preview/compose/sessions; `basename` session `filename`; tighten `assertNodeName` to `[a-z0-9-_]+`; shell-quote output path. (§12.5/§12.6)
2. **Fix scaffold** — emit `outline.md`, `status:"drafted"`. (§12.19)
3. **Per-session prompt file** — kill wrong-prompt dispatch; gitignore `.treewriter-prompts/`. (§12.4/§12.21)
4. **Unify `isUnitDir` + `orderedChildren`** into `modelFs.ts`; import in papers/export/compose. (§12.1/§12.2)
5. **Hardening tests** — sessions path rejection, count/export parity, prompt isolation. (§11/§12.20)

**Acceptance:** crafted `../` or `;` paths return 400; fresh scaffold shows compose summaries; preview A then B then run A uses A's prompt; dashboard counts match export walk; backend tests ≥ 70.

### M8 — Authoring UX (~3–4 days)

- Resizable outline/draft split + `localStorage` workspace persistence (nav, pane modes, graph scope, search, split ratio). (§12.16)
- Inline create/rename/delete forms — kill `window.prompt`/`confirm`. (§12.10)
- Dispatch command `<textarea>`. (§12.12)
- Auto-advance unit `status` on session→complete; auto-mark complete on post-dispatch `model-changed`. (§12.3/§12.11)
- CORS lock to `http://localhost:5173`. (§12.7)

**Acceptance:** refresh restores workspace state; create node without browser dialogs; dispatch shows full multi-line command; completed dispatch bumps unit to `drafted`.

### M9 — Export quality + Overleaf v1.1 (~3–5 days)

- Skip duplicate `# Title` when stitching child drafts in export/compose.
- Surface missing `[[wikilink]]` / citation warnings in export log.
- CSL/bibliography integration — start with roboculture `references.bib`.
- Overleaf push per [[phase-3-overleaf]].

**Acceptance:** roboculture export has no doubled section headings; missing cites listed in export response; Overleaf push produces compilable project.

### M10 — Navigation polish (~2–3 days) — **done**

- `GET /api/model/search` (F2).
- Graph `d3-zoom`, pan, keyboard a11y. (§12.13)
- Graph response cache + invalidate on model watch. (§12.21)
- Subsection drag-reorder in Papers panel.

### M11 — Collab (see [[phase-5-collaboration]]) — **done**

- Comments sidecar API (`.comments/`), `CommentsPanel` in editor.
- Overleaf feedback import (`POST /api/overleaf/import`).
- In-memory presence (`/api/presence/*`), edit-lock banner.

### M-docs — **done**

- Rewrote [[architecture]] component map + data flows (recursive 3-file model; no flat `drafts/`/`final/`).
- Synced [[PRD]] §4 API contract (search, section-compose, sessions, Overleaf, comments, presence).
- Fixed port map (TreeWriter 5173/4000; Quartz optional 8080).

---

## 14. Setup / run

```bash
# deps
cd view/backend  && pnpm install
cd view/frontend && pnpm install
brew install pandoc            # export (F6)
brew install tectonic          # PDF (optional, lightweight)

# run (two terminals)
cd view/backend  && pnpm dev   # :4000  API + PTY + git sync
cd view/frontend && pnpm dev   # :5173  UI

# test / typecheck
pnpm test                      # in each package
pnpm exec tsc --noEmit         # frontend

# example project
node scripts/scaffold-roboculture.mjs   # → model/papers/roboculture/
```

### Env vars (backend)
| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | 4000 | API port |
| `GIT_SYNC_ENABLED` | true | toggle auto-sync (`false` to disable) |
| `GIT_SYNC_INTERVAL_MS` | 120000 | sync cadence |
| `TREEWRITER_SHELL` | /bin/zsh | terminal shell |
| `TREEWRITER_TERMINAL_COMMAND` | python3 | PTY bridge runner |

### `.treewriter.json`
```json
{
  "aiProviders": [
    {"name":"Claude Code","command":"claude","args":["-p","{prompt}"],"writesFiles":true},
    {"name":"Aider","command":"aider","args":["--message","{prompt}","{files}"],"writesFiles":true},
    {"name":"Codex","command":"codex","args":["{prompt}"],"writesFiles":false}
  ],
  "defaultProvider":"Claude Code"
}
```
`{prompt}` → `"$(cat …prompt file)"`; `{files}` → unit `draft.md`. `writesFiles:false` ⇒ command appends `> draft.md`.
