# TreeWriterGit

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [pnpm](https://pnpm.io/) | JS package manager | `npm install -g pnpm` |
| [pandoc](https://pandoc.org/) | Export Markdown → LaTeX/PDF | `brew install pandoc` |
| [tectonic](https://tectonic-typesetting.github.io/) | PDF export (optional) | `brew install tectonic` |

LaTeX export works with pandoc alone (downloads `.tex`). PDF export needs a LaTeX engine — **tectonic** is recommended (~100MB). Alternative: `brew install --cask mactex` (full TeX Live, several GB). Without a PDF engine, **Export PDF** falls back to `.tex`.

Optional: `claude`, `codex`, or `aider` on `PATH` for AI dispatch (see `.treewriter.json`).

## Development

Install dependencies once:

```sh
pnpm --dir view install
```

Run the backend and frontend together from the repository root:

```sh
pnpm dev
```

The frontend runs at `http://localhost:5173/`. The backend runs at `http://localhost:4000/`.
