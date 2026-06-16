# TreeWriter View

The view is split into two packages:

* `frontend/`: TypeScript, Vite, React, Tailwind, and shadcn-style components.
* `backend/`: TypeScript Node server exposing a websocket terminal rooted at `model/`.

## Development

Install dependencies from `view/`:

```sh
cd view
pnpm install
```

Run both services together from the repository root:

```sh
pnpm dev
```

Or run them from `view/`:

```sh
cd view
pnpm dev
```

By default, the frontend runs on port `5173` and connects to the backend websocket at `ws://localhost:4000/terminal`.

## Backend API (summary)

### Model

* `GET /api/model/tree`
* `GET /api/model/file?path=` — lazy-creates missing `outline.md` / `draft.md` when appropriate
* `PUT /api/model/file`
* `POST /api/model/file`
* `POST /api/model/node`
* `DELETE /api/model/file?path=&recursive=`
* `POST /api/model/move`
* `POST /api/model/reorder`
* `GET /api/model/graph?root=`
* `GET /api/model/section-compose?path=` — stitched section outline + draft for `SectionWorkspace`
* `GET /api/model/search?q=&root=` — full-text search with path, line, excerpt
* `POST /api/overleaf/push` — export `.tex` + copy to `overleaf_repo_path`, git commit/push

### Papers & export

* `GET /api/paper/templates`
* `GET /api/papers` · `GET /api/papers?slug=`
* `POST /api/paper`
* `POST /api/export` `{ paperSlug, format: "latex"|"pdf", includeDrafts? }`
* `GET /api/export/download?file=`

### AI dispatch & sessions

* `GET /api/agent/providers`
* `POST /api/agent/preview`
* `GET /api/sessions?unitPath=`
* `POST /api/sessions` · `PATCH /api/sessions`

### Git sync & health

* `GET /health`
* `GET /api/git-sync/status`
* `POST /api/git-sync/run`

### WebSockets

* `WS /terminal` — xterm PTY (resize via fd-3 control channel)
* `WS /model-events` — file change notifications

## Git Sync

Git sync is enabled by default in the backend. Every 120 seconds it:

1. Fetches `origin`.
2. Commits pending `model/` changes with the message `Automated sync`.
3. Rebases onto the current branch's upstream.
4. Pushes.

Use `GIT_SYNC_ENABLED=false` to disable it or `GIT_SYNC_INTERVAL_MS=30000` to change the interval. The frontend header shows sync status and includes a manual sync button.

## Export prerequisites

LaTeX export requires [pandoc](https://pandoc.org/) (`brew install pandoc`). PDF export also needs a LaTeX engine — prefer [Tectonic](https://tectonic-typesetting.github.io/) (`brew install tectonic`, ~100MB) over full MacTeX. If no engine is installed, **Export PDF** automatically downloads `.tex` instead.

Exports are written to `.treewriter-exports/` at the repo root (gitignored).
