---
title: PRD — TreeWriter Scientific Writing Platform
summary: Product requirements with code-level implementation details, grounded in the actual repo. Supersedes the phase docs as the build authority.
composed_at_commit: null
status: draft
owner: Ilya Yakavets
---

# PRD — TreeWriter Scientific Writing Platform

This document is the build authority. It is grounded in the actual source (`view/backend/src/server.ts` ~720 lines, `view/backend/src/pty_bridge.py` ~114 lines, `view/frontend/src/App.tsx` ~520 lines, `view/frontend/src/components/nav/FolderBrowse.tsx` ~380 lines). Where the earlier phase docs ([[phase-0-fixes]] … [[phase-5-collaboration]]) describe intent, this document gives the concrete contract: exact endpoints, file changes, schemas, and acceptance criteria.

Related: [[tool-assessment]] (why we skip PageIndex / Quartz-as-server), [[architecture]] (system map), [[ai-terminal-controls]] (dispatch UX).

## 1. Goal and Non-Goals

### Goal
One local app where AI writes scientific paper text in Markdown and humans collaborate, with LaTeX/Overleaf as the presentation layer. The Markdown model in Git is the single source of truth. Authors trigger any AI CLI against specific sections from the UI; a graph view shows semantic links within and across papers.

### Non-Goals (this build)
- Running Quartz as a live service (borrow its graph idea, build native — see [[tool-assessment]]).
- PageIndex / vector RAG (corpus too small; Claude Code reads files natively).
- Authentication / multi-tenant (trusted team; identity via local config).
- Real-time collaborative cursors / CRDT editing (Git + autosave is enough).
- Round-tripping arbitrary LaTeX back to Markdown.

## 2. Current System (verified against code)

| Capability | Where | State |
|------------|-------|-------|
| Model tree read | `GET /api/model/tree` | works |
| File read/write | `GET/PUT /api/model/file` | works |
| File CRUD + nodes | `POST/DELETE /api/model/file`, `/api/model/node`, move, reorder | works |
| Path safety | `resolveModelPath()` blocks `..` escape | works |
| Git sync loop | 120s interval, `gitSync.ts` autostash + conflict detection | works |
| Terminal PTY + resize | fd-3 control channel in `pty_bridge.py` | works |
| Model events WS | `/model-events`, `fs.watch` | works |
| Wikilink graph | `GET /api/model/graph`, `GraphPanel.tsx` — semantic + structural edges | works |
| AI dispatch (F4 v1) | `DispatchPanel`, `/api/agent/*`, `refresh-index` action | works |
| Paper model (F5) | `papers.ts`, `POST /api/paper`, `GET /api/papers`, `PapersPanel` | works |
| Hybrid folder browse | `FolderBrowse.tsx` — INDEX hero, child cards, reorder, stale badge | works |
| Section compose view | `GET /api/model/section-compose`, `SectionWorkspace.tsx` — stitched child summaries + drafts | works |
| Unit dual-pane editor | `EditorWorkspace` — outline + draft side-by-side; leaf-unit routing via `isUnitFolder` | works |
| Clickable outline links | `MarkdownViewer` — wikilink preprocess, in-app nav via `resolveNavigateTarget` | works |
| Split editor | `MarkdownEditor` — Source / Split / Preview; compact rendered/raw per pane | works |
| Export (F6 v1) | `POST /api/export`, `GET /api/export/download`, pandoc → `.tex`/`.pdf`, PapersPanel buttons | works |
| Frontend 3-col UI | sidebar + center (browse / section / unit edit) + hideable Agent panel | works |

**Remaining gaps:**
- `GET /api/model/search` — full-text search (F2 polish)
- Comments API (`/api/comments`) — deferred to collaboration phase
- F4 polish — status auto-advance, context checklist UI, keyboard shortcuts, section fan-out
- F6 polish — CSL/bibliography, approved-only export, batch export
- UI polish — resizable outline/draft split, workspace state persistence across refresh (§12.16)
- AI-autonomous conflict resolution (sync v2) — manual terminal fallback only (v1)
- Server-side agent job manager — F4 v1.1

## 3. Feature Specs

Ordered by dependency. Each feature lists: change set (files), contract, implementation sketch, acceptance.

---

### F0 — Terminal resize (fix)

**Why:** terminal corrupts on any window resize; blocks usable AI sessions.

**Root cause:** resize messages arrive at `server.ts:375` and are dropped. The PTY parent (`pty_bridge.py`) only selects on `stdin` + `master_fd`; it has no channel to receive a resize and call `set_winsize(master_fd, …)`.

**Design:** add an out-of-band control channel on file descriptor 3.

`server.ts:314` — spawn with a 4th pipe:
```ts
const term = spawn(terminalCommand, terminalArgs, {
  cwd: modelRoot,
  env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", HISTFILE: "/dev/null", BASH_SILENCE_DEPRECATION_WARNING: "1" },
  stdio: ["pipe", "pipe", "pipe", "pipe"]   // add fd 3 for control
});
const controlFd = term.stdio[3] as NodeJS.WritableStream;
```

`server.ts:375` — implement handler:
```ts
if (message.type === "resize") {
  const { cols, rows } = message;
  if (Number.isFinite(cols) && Number.isFinite(rows)) {
    controlFd.write(JSON.stringify({ t: "resize", cols, rows }) + "\n");
  }
}
```

`pty_bridge.py` — read fd 3 in the select loop, parse JSON lines, call existing `set_winsize` on `master_fd`:
```python
import json
control_fd = 3
control_buf = b""
# in select: readable, _, _ = select.select([sys.stdin.buffer, master_fd, control_fd], [], [])
if control_fd in readable:
    chunk = os.read(control_fd, 4096)
    if chunk:
        control_buf += chunk
        while b"\n" in control_buf:
            line, control_buf = control_buf.split(b"\n", 1)
            try:
                msg = json.loads(line)
                if msg.get("t") == "resize":
                    set_winsize(master_fd, int(msg["rows"]), int(msg["cols"]))
                    os.kill(child_pid, signal.SIGWINCH)
            except (ValueError, KeyError, OSError):
                pass
```
Note: `set_winsize` must target `master_fd` (the controlling pty) and then `SIGWINCH` the child so the shell re-reads window size.

**Frontend:** already sends resize (`App.tsx:489` `sendResize`). No change.

**Acceptance:** resize browser; run `tput cols` in terminal → reflects new width; `vim`/`htop` redraw correctly; no garbled wrap.

---

### F1 — Git conflict guard (fix)

**Why:** a single rebase conflict permanently wedges sync.

**Change:** `server.ts:132` `runGitSync()`.

```ts
type GitSyncState = { /* …existing… */ conflictDetected: boolean; };
// init conflictDetected: false at :60

// replace the rebase line :151
try {
  output.push(await git(["rebase", "origin/main"]));
  gitSyncState.conflictDetected = false;
} catch (rebaseErr) {
  await git(["rebase", "--abort"]).catch(() => {});
  gitSyncState.conflictDetected = true;
  throw new Error("Rebase conflict — aborted; manual merge required in terminal.");
}
output.push(await git(["push", "origin", "HEAD:main"]));
```

**Frontend:** `App.tsx:665` footer — when `gitSync.conflictDetected`, render a red banner: "Git conflict — resolve in terminal, then Run Sync." Read field from existing `/api/git-sync/status` poll (`:410`).

**Acceptance:** force a conflict between two clones; sync surfaces banner instead of silent repeated failure; repo not left mid-rebase (`git status` clean).

---

### F2 — File CRUD

**Why:** foundation for the recursive paper tree ([[phase-2-paper-model]]) and everyday authoring. Sections, subsections, sub-subsections, and units are all created from the UI. No create/delete/move today.

**Endpoints (all reuse `toModelPath` `server.ts:73` for safety):**

| Method | Path | Body / Query | Behavior |
|--------|------|--------------|----------|
| POST | `/api/model/file` | `{ path, content? }` | Create a single file; `mkdir -p` parents; 409 if exists. |
| POST | `/api/model/node` | `{ parent, name, kind }` | Create a tree node. `kind: "container"` → `parent/name/INDEX.md` (section/subsection skeleton). `kind: "unit"` → `parent/name/{INDEX.md (metadata, status:outline), outline.md (overview), draft.md (empty)}`. Appends `name` to the parent `INDEX.md` `child_order`. 409 if exists. |
| DELETE | `/api/model/file` | `?path=` | Delete file/dir; 409 if non-empty dir unless `?recursive=true`. Removes the entry from parent `child_order`. |
| POST | `/api/model/move` | `{ from, to }` | `fs.rename`; `mkdir -p` target parent; update both parents' `child_order`; broadcast both paths. |
| POST | `/api/model/reorder` | `{ parent, child_order[] }` | Rewrite a container `INDEX.md` `child_order` (drag-reorder in UI). |

Each mutation calls `broadcastModelEvent({ type: "model-changed", path })` (same as `:218`). Git sync picks up via existing `git add model` (`:147`).

**`child_order` maintenance is required (not optional):** node order is editorial and drives export (F6) and rendering. The create/delete/move/reorder endpoints keep each container's `INDEX.md` `child_order` in sync. Containers are recursive — a "New subsection" under a section and a "New unit" under a subsection are the same operation at different depths.

**Implementation sketch (POST):**
```ts
app.post("/api/model/file", async (req, res, next) => {
  try {
    const rel = String(req.body?.path ?? "");
    const abs = toModelPath(rel);
    if (fs.existsSync(abs)) return res.status(409).json({ error: "Exists" });
    if (rel.endsWith("/")) {
      await mkdir(abs, { recursive: true });
      await writeFile(path.join(abs, "INDEX.md"), indexSkeleton(rel), "utf8");
    } else {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, String(req.body?.content ?? ""), "utf8");
    }
    broadcastModelEvent({ type: "model-changed", path: rel });
    res.json({ ok: true, path: rel });
  } catch (e) { next(e); }
});
```
`indexSkeleton(rel, kind)` returns the frontmatter + body for the node kind ([[phase-2-paper-model]] schemas): container → `kind, title, child_order: []`, body = idea placeholder; unit → `kind: unit, title, status: outline, links: []`, body = idea placeholder. Unit create also writes an empty `draft.md`.

**Comments sidecar (data model fixed here):** comments attach to **any** `.md` — both a unit's `INDEX.md` (idea) and its `draft.md` (text) — stored in `sections/.comments/{relative-path}.comments.json`. Endpoints `GET/POST/PATCH/DELETE /api/comments` land with F5/F-collab; the path scheme is reserved now so nothing else writes there ([[phase-2-paper-model]], [[phase-5-collaboration]]).

**Frontend:** sidebar (`:579`) context actions — "New section / subsection / unit" (kind inferred from the selected node's depth, overridable) → `POST /api/model/node`. Card header (`:325`) gets rename + delete (delete behind confirm). Drag-reorder siblings → `POST /api/model/reorder`. On success, existing model-events reload (`:430`) refreshes tree + graph.

**Acceptance:** create a section, then a unit inside it, from the UI; both appear; parent `child_order` updated; a unit has `INDEX.md`+`draft.md`; delete removes node and its `child_order` entry; reorder persists; path traversal (`../`) rejected with 400.

---

### F3 — Wikilink graph (native, replaces Quartz server)

**Why:** navigate within a paper (outline→draft→final) and across papers (shared methods, figures, literature) by semantic links. Borrow Quartz's d3-force visual; build native so it is live and queryable (see [[tool-assessment]]).

**Backend — new endpoint:**
```
GET /api/model/graph?root=papers/ml-study   (root optional; default whole model)
→ { nodes: [{ id, label, type, links }], edges: [{ source, target }] }
```
- Walk `.md` files under root (reuse `readModelTree` traversal).
- For each file, regex wikilinks: `/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g` and embeds `/!\[\[([^\]]+)\]\]/g`.
- Resolve target to a model-relative path: try exact, then `${target}.md`, then basename match across model (Obsidian-style). Unresolved targets become `type:"missing"` nodes (surfaces broken links).
- `node.type` from frontmatter `tags` or path heuristic: `paper | section | note | figure | missing`.
- `node.links` = incoming+outgoing count (drives radius).
- Cache parse result; invalidate on `fs.watch` (`:297`) — recompute lazily on next request.

**Frontend — new graph panel.** Add deps: `d3-force`, `d3-selection`, `d3-zoom` (or `d3` meta-package; ~30KB gz tree-shaken). New component `GraphPanel.tsx`:
- `forceSimulation(nodes).force("link", forceLink(edges).distance(30)).force("charge", forceManyBody().strength(-120)).force("center", …)`.
- SVG render; node radius ∝ `links`; color by `type`; click → `onSelectNode(path)` which sets the editor's current file and the AI dispatch context (F4).
- Hover highlights 1-hop neighbors (focus-on-hover, Quartz-style).
- Toggle local (1–2 hop from current) vs global.

**Layout change:** `App.tsx:578` grid becomes 4 zones. Proposed:
```
grid-cols-[220px_minmax(360px,1fr)_minmax(300px,28vw)]
  + a top/bottom split in the right column: Graph (top) / Terminal+Dispatch (bottom)
```
Keep sidebar tree (cheap, complements graph). Graph replaces nothing destructive; it is additive.

**Acceptance:** `[[introduction]]` in a note draws an edge to `introduction.md`; figure referenced by two papers appears as one node linking both; clicking a node loads it in the editor and sets dispatch context; broken link renders as a distinct "missing" node.

---

### F4 — AI dispatch panel (any CLI)

**Status: v1 complete** (2026-06-15). Terminal-dispatch loop shipped; polish items below are v1.1.

**Why:** trigger generation/revision against a specific section without hand-writing prompts; not locked to Claude. See [[ai-terminal-controls]].

**Config file `.treewriter.json` (repo root), read at startup:**
```json
{
  "aiProviders": [
    { "name": "Claude Code", "command": "claude", "args": ["-p", "{prompt}"], "writesFiles": true },
    { "name": "Codex",       "command": "codex",  "args": ["{prompt}"],        "writesFiles": false },
    { "name": "Aider",       "command": "aider",  "args": ["--message", "{prompt}", "{files}"], "writesFiles": true }
  ],
  "defaultProvider": "Claude Code"
}
```

**Backend endpoints:**
| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/agent/providers` | parsed `aiProviders` (or built-in default if file absent) |
| POST | `/api/agent/preview` | `{ provider, unitPath, action, contextFiles[], options }` → `{ prompt, command, outputPath }` (no execution) |

The dispatch target is a **unit** (`unitPath` = e.g. `papers/ml-study/sections/introduction/problem`). `preview` builds the prompt from action templates (draft / revise / expand / cite-check / custom) using:
- the unit's **`outline.md`** overview (what this paragraph must say),
- comments on the unit's `INDEX.md` and `draft.md` (steer generation/revision),
- wikilinked nodes in the unit `links:` (e.g. the results unit a claim depends on),
- `notes/literature/*` whose `relevance` includes this section, `notes/data/*` whose `sections` includes it,
- unresolved `notes/feedback/*` for the section,
- for **revise**: the current `draft.md`.
`outputPath` = the unit's `draft.md` (overwritten in place; Git history is the version trail — no `-vN` files). A "draft section" action fans out over every unit via the section's `child_order`.

**Execution path (minimal, no new process management):** the frontend already owns a terminal WebSocket (`App.tsx:478`). Dispatch = (1) call `/api/agent/preview`, (2) optionally show prompt in a modal to edit, (3) write the returned `command` into the terminal socket as `input` (`:501`). The user sees the AI run live in the existing terminal; Claude Code writes `draft.md` itself; `fs.watch` → model-event → tree/graph/card refresh.
- For `writesFiles:false` providers (Codex), the built command appends a redirect to the unit's `draft.md`.
- On a successful draft/revise, the unit `INDEX.md` `status` advances `outline→drafted`; `approved` stays a human action in the UI.

This avoids a server-side job manager in v1. (A `/api/agent/dispatch` with PTY job tracking is a v1.1 option if we want cancellation + history.)

**Frontend — dispatch panel** (in right column, above/below terminal): selectors Unit / Provider / Action, auto-filled from the graph/editor selection (F3); checklist of auto-selected context files; "Preview prompt" and "Run" buttons. Run writes to the terminal socket.

**Acceptance:** select a unit, choose Claude Code + Draft, Run; terminal shows `claude -p "…"`; the unit's `draft.md` fills in and the card refreshes; switching provider to Codex changes the command; Preview shows the full prompt and is editable before Run.

**v1.1 polish (open):** unit `status` auto-advance to `drafted`; context files checklist; keyboard shortcuts; section fan-out draft.

---

### F5 — Scientific paper model

**Status: complete** (2026-06-15). Scaffold, list, dashboard, and notes-aware dispatch context shipped.

**Why:** structure the model for papers; powers context auto-selection (F4) and export ordering (F6). See [[phase-2-paper-model]].

**Structure** is the recursive section→unit tree defined in [[phase-2-paper-model]] (containers with `child_order`; units = folder of `INDEX.md` metadata + `outline.md` overview + `draft.md` text; `status` per unit replaces the old `drafts/`/`final/` split). Frontmatter schemas (paper / container / unit / notes) live in that doc.

**Scaffold** (via F2 `POST /api/model/node`) under `model/papers/{slug}/`: paper `INDEX.md`, `sections/` containing the journal's standard sections as empty containers (Introduction, Methods, Results, Discussion, Conclusion, Supporting Information), and `notes/{literature,data,feedback}/`. Section set + order come from `model/templates/{journal}.md`.

**Backend:** `POST /api/paper` `{ title, journal, authors, slug? }` → scaffold from journal template. `GET /api/papers` → list with status + per-status unit roll-up (walk each paper's `child_order`, count unit `status`).

**Frontend:** "New Paper" modal; Papers dashboard (journal, status, units `approved/drafted/outline`, last export); per-section roll-up on drill-in. "New section/subsection/unit" via F2.

**Acceptance:** create paper → recursive tree with standard sections appears; dashboard shows `0 approved / 0 drafted / N outline`; adding a unit and drafting it (F4) moves the count; context auto-selection (F4) reads unit `links` + notes `relevance`/`sections` correctly.

---

### F6 — LaTeX / PDF export (pandoc)

**Why:** produce the Overleaf-facing artifact. See [[phase-3-overleaf]]. Requires `brew install pandoc` (+ MacTeX for PDF).

**Endpoint:** `POST /api/export` `{ paperSlug, format: "latex"|"pdf", includeDrafts?: boolean }` →
1. Depth-first walk: paper `INDEX.section_order` → each container's `child_order` → recurse. At each **unit**, take `draft.md`.
2. Include units with `status: approved` (default) or all when `includeDrafts`. Heading level = tree depth (section→`\section`, subsection→`\subsection`, …). Concatenate into a temp `combined.md`.
3. Collect `[@cite_key]` used; generate `.bib` from `notes/literature/*` (cite_key→entry).
4. Run `pandoc combined.md --from markdown --to {latex|pdf} --bibliography gen.bib [--csl templates/{journal}.csl] -o out.{tex|pdf}` via `execFile`.
5. Return `{ path, downloadUrl }`; write `last_export` timestamp back to paper `INDEX.md`.

**Overleaf sync (v1.1, see [[phase-3-overleaf]]):** if `overleaf_repo_path` set, copy `out.tex` into that local Overleaf-Git-Bridge clone, commit, push. Comment import is a separate Python script writing `notes/feedback/`.

**Frontend:** Export dropdown in paper dashboard (Download .tex / .pdf; Open in Overleaf when configured).

**Acceptance:** export walks `section_order` then `child_order` (not alphabetical); only `approved` units appear by default; nesting maps to heading depth; `[@key]` becomes `\cite{key}`; `.tex` compiles in Overleaf; missing pandoc returns a clear install hint, not a 500 stack.

## 4. API Contract (summary)

| Method | Endpoint | Feature | New? |
|--------|----------|---------|------|
| GET | `/api/model/tree` | core | exists `:173` |
| GET/PUT | `/api/model/file` | core | exists `:184/:205` |
| POST/DELETE | `/api/model/file` | F2 | new |
| POST | `/api/model/node` | F2 | new |
| POST | `/api/model/move` · `/api/model/reorder` | F2 | new |
| GET/POST/PATCH/DELETE | `/api/comments` | F2 model / F-collab | new |
| GET | `/api/model/graph` | F3 | new |
| GET | `/api/agent/providers` | F4 | done |
| POST | `/api/agent/preview` | F4 | done |
| GET | `/api/paper/templates` | F5 | done |
| POST | `/api/paper` · GET `/api/papers` | F5 | done |
| POST | `/api/export` · GET `/api/export/download` | F6 | done |
| GET/POST | `/api/git-sync/status` · `/run` | core | exists `:229/:233` (+conflictDetected F1) |
| WS | `/terminal` · `/model-events` | core | exists `:281/:283` (+resize F0) |

## 5. Sequencing and Estimates

| Milestone | Features | Est. | Status |
|-----------|----------|------|--------|
| M1 — Stabilize | F0, F1 | 1 day | done |
| M2 — Authoring base | F2 | 2 days | done (search/comments deferred) |
| M3 — Navigation | F3 | 2–3 days | done |
| M4 — AI loop | F4 | 2–3 days | done (v1.1 polish open) |
| M5 — Paper model | F5 full | 1–2 days | done |
| M6 — Output | F6 (export v1), Overleaf v1.1 | 2–3 days | export v1 **done**; Overleaf push + comment import **next** |

Total ≈ 10–14 working days for M1–M6. M1–M4 is the demoable core (≈ 7–9 days).

## 6. Dependencies to Install
- Frontend: `d3-force d3-selection d3-zoom` (F3).
- System: `brew install pandoc` (F6); `brew install --cask mactex` only if PDF export needed.
- Optional: `claude` / `codex` / `aider` on PATH (F4 — user-provided).
- `.treewriter.json` at repo root (F4) — ship a default; code falls back to built-in Claude Code provider if absent.

## 7. Risks
- **fd-3 control channel portability** (F0): macOS/Linux only; fine for target. Fallback: encode resize as an escape on stdin parsed by the bridge.
- **Wikilink resolution ambiguity** (F3): basename collisions across papers. Mitigate: prefer exact path, then nearest-by-directory; mark ambiguous as `missing` and log.
- **Provider variance** (F4): Codex/Aider don't write files like Claude Code. Mitigate: `writesFiles` flag + shell redirect for stdout providers.
- **Pandoc fidelity** (F6): complex LaTeX won't round-trip. Mitigate: unit `draft.md` Markdown is source; keep a `raw-latex/` `\input` escape hatch (see [[technical-decisions]] TD-1).
- **Layout density** (F3/F4): four zones risk crowding. Mitigate: collapsible graph/dispatch panels; reuse existing grid.

## 8. Out of Scope (deferred, with trigger)
- PageIndex RAG — revisit when model exceeds ~50 files ([[tool-assessment]]).
- Quartz static export for remote reviewers — on-demand `npx quartz build` only, not in dev loop.
- Auth / presence / inline comments — [[phase-5-collaboration]]; add when team > ~5 or exposed beyond localhost.
- Server-side agent job manager with cancel/history — v1.1 upgrade to F4.
