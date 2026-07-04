# TreeWriter

Git-native writing for papers, grants, and reports. Your manuscript lives in Markdown folders under `model/`; the app gives you an IDE-style editor, AI dispatch, and export to LaTeX, PDF, or Word.

## Try it

Install dependencies once:

```sh
pnpm --dir view install
```

Run the backend and frontend together:

```sh
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and go to **Papers → TreeWriter Guide** — a walkthrough paper that shows outline, draft, approval, and export.

## What's in the repo

| Path | What it is |
|------|------------|
| `model/papers/` | Manuscripts (start with `treewriter-guide/`) |
| `model/TreeWriter/` | How the folder schema works (`model-directory.md`) |
| `view/` | React frontend + Express backend — see [view/README.md](view/README.md) for the API |

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [pnpm](https://pnpm.io/) | JS package manager | `npm install -g pnpm` |
| [pandoc](https://pandoc.org/) | Export Markdown → LaTeX/PDF | `brew install pandoc` |
| [tectonic](https://tectonic-typesetting.github.io/) | PDF export (optional) | `brew install tectonic` |

LaTeX export works with pandoc alone (downloads `.tex`). PDF export needs a LaTeX engine — **tectonic** is recommended (~100MB). Alternative: `brew install --cask mactex` (full TeX Live, several GB). Without a PDF engine, **Export PDF** falls back to `.tex`.

Optional: `claude`, `codex`, or `aider` on `PATH` for AI dispatch (see `.treewriter.json`).

## Learn more

- [view/COLLABORATION.md](view/COLLABORATION.md) — approval workflow, comments, git sync
- [model/TreeWriter/model-directory.md](model/TreeWriter/model-directory.md) — INDEX / outline / draft conventions
- [model/DevPlan/DEVELOPMENT.md](model/DevPlan/DEVELOPMENT.md) — as-built technical reference for contributors

## Tests

```sh
pnpm test                  # unit tests (backend + frontend)
pnpm --dir view ci:all     # lint, test, build (matches CI)
```
