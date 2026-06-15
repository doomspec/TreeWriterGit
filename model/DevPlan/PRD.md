---
title: PRD — TreeWriter Scientific Writing Platform
summary: Product requirements with code-level implementation details, grounded in the actual repo. Supersedes the phase docs as the build authority.
composed_at_commit: null
status: draft
owner: Ilya Kavets
---

# PRD — TreeWriter Scientific Writing Platform

This document is the build authority. It is grounded in the actual source (`view/backend/src/server.ts` 382 lines, `view/backend/src/pty_bridge.py` 75 lines, `view/frontend/src/App.tsx` 705 lines). Where the earlier phase docs ([[phase-0-fixes]] … [[phase-5-collaboration]]) describe intent, this document gives the concrete contract: exact endpoints, file changes, schemas, and acceptance criteria.

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
| Model tree read | `server.ts:173` `GET /api/model/tree`, `readModelTree()` `:88` | works |
| File read | `server.ts:184` `GET /api/model/file?path=` | works |
| File write | `server.ts:205` `PUT /api/model/file` | works |
| Path safety | `server.ts:73` `toModelPath()` blocks `..` escape | works |
| Git sync loop | `server.ts:132` `runGitSync()`, 120s interval `:308` | works, no conflict handling |
| Terminal PTY | `server.ts:314` + `pty_bridge.py` | works, resize is a no-op |
| Model events WS | `server.ts:255` `/model-events`, `fs.watch` `:297` | works |
| Frontend 3-col UI | `App.tsx:578` `grid-cols-[260px_minmax(420px,1fr)_minmax(320px,34vw)]` | works |
| Markdown card edit/autosave | `App.tsx:196` `MarkdownCard`, 800ms debounce `:255` | works |

**Confirmed gaps (code-level):**
- `server.ts:375` — `if (message.type === "resize") {}` empty. PTY fixed at 24×80 (`pty_bridge.py:23` calls `set_winsize(slave_fd)` once with defaults).
- `server.ts:151` — `git rebase` failure caught into `lastError` but repo left mid-rebase; next sync also fails.
- No create / delete / move endpoints. No wikilink graph. No AI dispatch. No paper model. No export. No `.treewriter.json`. No `d3` / `pandoc` installed.

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

**Why:** foundation for paper scaffolding (F5) and everyday authoring. No create/delete/move today.

**Endpoints (all reuse `toModelPath` `server.ts:73` for safety):**

| Method | Path | Body / Query | Behavior |
|--------|------|--------------|----------|
| POST | `/api/model/file` | `{ path, content? }` | Create file; `mkdir -p` parents; 409 if exists. If `path` ends `/`, create dir + `INDEX.md` skeleton. |
| DELETE | `/api/model/file` | `?path=` | Delete file; 409 if directory non-empty; recursive only with `?recursive=true`. |
| POST | `/api/model/move` | `{ from, to }` | `fs.rename`; `mkdir -p` target parent; broadcast both paths. |

Each mutation calls `broadcastModelEvent({ type: "model-changed", path })` (same as `:218`). Git sync picks up via existing `git add model` (`:147`).

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
`indexSkeleton(rel)` returns frontmatter (`title` from last path segment, `summary: ""`, `composed_at_commit: null`) + `# Title` + `## Outline`.

**Frontend:** `App.tsx` sidebar (`:579`) gets a `+` button → modal (file vs folder, name). Card header (`:325`) gets rename + delete buttons (delete behind confirm). On success, existing model-events reload (`:430`) refreshes tree.

**INDEX.md auto-maintenance (optional, v1.1):** on create/delete/move, patch the parent `INDEX.md` `## Outline` list. Defer if it complicates v1 — Quartz/graph reads links live regardless.

**Acceptance:** create nested file via UI; appears in tree; delete removes it; rename updates path; all reflected after one model-event cycle; path traversal (`../`) rejected with 400.

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
| POST | `/api/agent/preview` | `{ provider, paperSlug, section, action, contextFiles[], options }` → `{ prompt, command, outputPath }` (no execution) |

`preview` builds the prompt from action templates (draft / revise / expand / cite-check / custom) using:
- outline file for the section,
- `notes/literature/*` whose frontmatter `relevance` includes the section,
- `notes/data/*` whose `sections` includes the section,
- unresolved `notes/feedback/*` for the section.
`outputPath` = `papers/{slug}/drafts/{section}-v{N+1}.md` (scan existing `-v*.md`).

**Execution path (minimal, no new process management):** the frontend already owns a terminal WebSocket (`App.tsx:478`). Dispatch = (1) call `/api/agent/preview`, (2) optionally show prompt in a modal to edit, (3) write the returned `command` into the terminal socket as `input` (`:501`). The user sees the AI run live in the existing terminal; Claude Code writes the file itself; `fs.watch` → model-event → tree/graph refresh.
- For `writesFiles:false` providers (Codex), append a shell redirect in the built command: `codex "<prompt>" > "papers/.../drafts/section-vN.md"`.

This avoids a server-side job manager in v1. (A `/api/agent/dispatch` with PTY job tracking is a v1.1 option if we want cancellation + history.)

**Frontend — dispatch panel** (in right column, above/below terminal): selectors Paper / Section / Stage / Provider / Action, auto-filled from the graph/editor selection (F3); checklist of auto-selected context files; "Preview prompt" and "Run" buttons. Run writes to the terminal socket.

**Acceptance:** select a section, choose Claude Code + Draft, Run; terminal shows `claude -p "…"`; a new `drafts/{section}-v1.md` appears and shows in tree/graph; switching provider to Codex changes the command; Preview shows the full prompt and is editable before Run.

---

### F5 — Scientific paper model

**Why:** structure the model for papers; powers context auto-selection (F4) and export ordering (F6). See [[phase-2-paper-model]].

**Scaffold** (via F2 endpoints) under `model/papers/{slug}/` with `outlines/ notes/{literature,data,feedback}/ drafts/ final/`, each with `INDEX.md`.

**Paper `INDEX.md` frontmatter (canonical):**
```yaml
title: "…"
journal: "PLOS ONE"
status: "Drafting"          # Planning|Drafting|Reviewing|Submitted|Published
authors: ["Ilya Kavets"]
target_words: 5000
section_order: ["outlines/abstract.md","outlines/introduction.md","outlines/methods.md","outlines/results.md","outlines/discussion.md"]
overleaf_repo_path: null
last_export: null
```

**Outline / section file frontmatter:** `section`, `target_words`, `status` (outline|drafted|approved|final), `ai_context: []`, `citations_required: []`.
**Note frontmatter:** literature → `cite_key, authors, year, claim, relevance[]`; data → `figure, path, caption_draft, sections[]`; feedback → `source, date, reviewer, section, resolved`.

**Backend:** `POST /api/paper` `{ title, journal, authors, slug? }` → creates scaffold from a journal template in `model/templates/{journal}.md`. `GET /api/papers` → list with status + section counts (read each paper `INDEX.md`).

**Frontend:** "New Paper" button → modal; a Papers dashboard (status, sections drafted/approved, last export).

**Acceptance:** create paper → full tree appears; dashboard shows 0/5 approved; section frontmatter `status` editable; context auto-selection (F4) reads `relevance`/`sections` correctly.

---

### F6 — LaTeX / PDF export (pandoc)

**Why:** produce the Overleaf-facing artifact. See [[phase-3-overleaf]]. Requires `brew install pandoc` (+ MacTeX for PDF).

**Endpoint:** `POST /api/export` `{ paperSlug, format: "latex"|"pdf" }` →
1. Read paper `INDEX.md` `section_order`.
2. Concatenate `final/` files in that order into a temp `combined.md` (insert `\section{}`-friendly headers).
3. Collect `[@cite_key]` used; generate `.bib` from `notes/literature/*` (cite_key→entry).
4. Run `pandoc combined.md --from markdown --to {latex|pdf} --bibliography gen.bib [--csl templates/{journal}.csl] -o out.{tex|pdf}` via `execFile`.
5. Return `{ path, downloadUrl }`; write `last_export` timestamp back to paper `INDEX.md`.

**Overleaf sync (v1.1, see [[phase-3-overleaf]]):** if `overleaf_repo_path` set, copy `out.tex` into that local Overleaf-Git-Bridge clone, commit, push. Comment import is a separate Python script writing `notes/feedback/`.

**Frontend:** Export dropdown in paper dashboard (Download .tex / .pdf; Open in Overleaf when configured).

**Acceptance:** export assembles sections in `section_order` (not alphabetical); `[@key]` becomes `\cite{key}`; `.tex` compiles in Overleaf; missing pandoc returns a clear install hint, not a 500 stack.

## 4. API Contract (summary)

| Method | Endpoint | Feature | New? |
|--------|----------|---------|------|
| GET | `/api/model/tree` | core | exists `:173` |
| GET/PUT | `/api/model/file` | core | exists `:184/:205` |
| POST/DELETE | `/api/model/file` | F2 | new |
| POST | `/api/model/move` | F2 | new |
| GET | `/api/model/graph` | F3 | new |
| GET | `/api/agent/providers` | F4 | new |
| POST | `/api/agent/preview` | F4 | new |
| POST | `/api/paper` · GET `/api/papers` | F5 | new |
| POST | `/api/export` | F6 | new |
| GET/POST | `/api/git-sync/status` · `/run` | core | exists `:229/:233` (+conflictDetected F1) |
| WS | `/terminal` · `/model-events` | core | exists `:281/:283` (+resize F0) |

## 5. Sequencing and Estimates

| Milestone | Features | Est. | Unblocks |
|-----------|----------|------|----------|
| M1 — Stabilize | F0, F1 | 1 day | usable terminal + sync |
| M2 — Authoring base | F2 | 2 days | scaffolding, editing CRUD |
| M3 — Navigation | F3 | 2–3 days | graph, cross-paper nav |
| M4 — AI loop | F4 (+ minimal F5 frontmatter) | 2–3 days | the core value prop |
| M5 — Paper model | F5 full | 1–2 days | dashboard, context rules |
| M6 — Output | F6 (export), Overleaf v1.1 | 2–3 days | collaborator handoff |

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
- **Pandoc fidelity** (F6): complex LaTeX won't round-trip. Mitigate: `final/` Markdown is source; keep a `raw-latex/` `\input` escape hatch (see [[technical-decisions]] TD-1).
- **Layout density** (F3/F4): four zones risk crowding. Mitigate: collapsible graph/dispatch panels; reuse existing grid.

## 8. Out of Scope (deferred, with trigger)
- PageIndex RAG — revisit when model exceeds ~50 files ([[tool-assessment]]).
- Quartz static export for remote reviewers — on-demand `npx quartz build` only, not in dev loop.
- Auth / presence / inline comments — [[phase-5-collaboration]]; add when team > ~5 or exposed beyond localhost.
- Server-side agent job manager with cancel/history — v1.1 upgrade to F4.
