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

## Model Editing

The backend exposes the model tree and file contents:

* `GET /api/model/tree`
* `GET /api/model/file?path=INDEX.md`
* `PUT /api/model/file`
* `WS /model-events`

The frontend uses these endpoints to display `model/`, edit Markdown files, save changes back to disk, and refresh when files change outside the browser.

## Git Sync

Git sync is enabled by default in the backend. Every 120 seconds it:

1. Fetches `origin`.
2. Commits pending `model/` changes with the message `Automated sync`.
3. Rebases onto `origin/main`.
4. Pushes `HEAD` to `origin/main`.

Use `GIT_SYNC_ENABLED=false` to disable it or `GIT_SYNC_INTERVAL_MS=30000` to change the interval. The frontend header shows sync status and includes a manual sync button.
