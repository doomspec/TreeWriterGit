---
title: Quartz Graph Integration
summary: Replace the custom React navigation UI with Quartz for graph-based reading and navigation across papers, sections, notes, and figures.
composed_at_commit: null
---

# Quartz Graph Integration

## Why Quartz

The current TreeWriter React frontend (`App.tsx`, 705 lines) reimplements a basic file tree + Markdown viewer. Quartz provides all of this and more — for free:

| Feature | Current React UI | Quartz |
|---------|-----------------|--------|
| File tree navigation | ✓ sidebar | ✓ sidebar + search |
| Markdown rendering | ✓ basic | ✓ GFM + callouts + math + Mermaid |
| Cross-file links | ✗ | ✓ wikilinks `[[note]]` |
| Graph view | ✗ | ✓ local + global, interactive D3 |
| Full-text search | ✗ | ✓ built-in |
| Backlinks panel | ✗ | ✓ shows what links to current note |
| Tags + filtering | ✗ | ✓ tag taxonomy |
| Figure embedding | ✗ | ✓ image + Excalidraw |
| Cross-paper navigation | ✗ | ✓ via shared wikilink targets |

Your existing quartz-vault at `~/Documents/quartz-vault` already has wikilinks, Obsidian-flavored Markdown, Excalidraw, and graph view configured.

## Deployment Architecture

```
TreeWriterGit repo root/
├── model/              ← Markdown content (source of truth)
├── quartz/             ← Quartz instance (NEW, symlinked or copied)
│   ├── content → ../model/   ← symlink: Quartz reads model/ as content
│   ├── quartz.config.yaml
│   └── public/         ← built static site
└── view/               ← TreeWriter backend + editor UI (unchanged)
    ├── backend/        ← Git sync, file API, terminal, AI dispatch
    └── frontend/       ← editor panel only (stripped of navigation)
```

Quartz watches `model/` and rebuilds on change (watch mode). Built site served at `localhost:8888` (or any port). TreeWriter editor panel served at `localhost:5173` as before.

## Two-Panel Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [Quartz — localhost:8888]          [TreeWriter — localhost:5173] │
│                                                                   │
│  ┌──────────────────────────┐       ┌───────────────────────────┐│
│  │ Graph view               │       │ Editor                    ││
│  │                          │       │ ─────────────────────────  ││
│  │    [ml-study]            │       │ papers/ml-study/           ││
│  │       ↕                  │  ←→   │ drafts/introduction-v2.md  ││
│  │   [introduction]──[methods]      │                            ││
│  │       ↕         ↕        │       │ [textarea for editing]     ││
│  │  [protocol]  [cell-viability]    │                            ││
│  │       ↕                  │       ├───────────────────────────┤│
│  │  [lit/hemocytometer]     │       │ AI Dispatch               ││
│  │                          │       │ AI: [Claude Code ▼]       ││
│  ├──────────────────────────┤       │ Action: [Draft ▼]         ││
│  │ Current: introduction    │       │ Context: introduction      ││
│  │ Backlinks: (3)           │       │ [▶ Run Agent]             ││
│  │ Tags: #methods #ml       │       │                            ││
│  └──────────────────────────┘       └───────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

The two panels communicate: clicking a node in Quartz graph updates the editor panel's context (current section for AI dispatch). Implemented via URL params or `postMessage` between iframes.

## Graph Nodes by Type

### Paper nodes
Each paper's `INDEX.md` becomes a top-level node. Frontmatter `tags: [paper, plos-one]` clusters papers by journal in the global graph.

### Section nodes (outlines → drafts → final)
Each section file is a node. Status shown via frontmatter tag: `tags: [section, status/drafting]`. Graph visually distinguishes status by node color (configurable in Quartz CSS).

### Note nodes
Literature notes, data notes, feedback notes all become nodes. Their wikilinks to sections create edges: `[[introduction]]` in a literature note draws an edge from that reference to the introduction section.

### Figure nodes
`notes/data/fig-time-comparison.md` is a node. It links to `[[results]]` via wikilink. In global graph: the figure appears connected to every section that references it — across papers.

### Cross-paper connections
If `papers/ml-study/notes/literature/hemocytometer-cv.md` and `papers/lh-study/notes/literature/hemocytometer-cv.md` both link to `[[shared/bibliography]]`, they appear as sibling nodes in the global graph. Shared methods appear as hubs with many incoming edges.

## Wikilink Conventions

```markdown
<!-- Within a paper -->
See [[introduction]] for context.
Data from [[notes/data/participant-stats]].
Based on [[lit/hemocytometer-1962]].

<!-- Cross-paper (rooted from model/) -->
[[papers/lh-study/outlines/methods]] uses the same protocol.
See [[shared/abbreviations]] for terminology.

<!-- Figures -->
![[notes/data/fig-time-comparison.png]]
See [[notes/data/fig-time-comparison]] for caption and stats.
```

Quartz resolves these relative to the content root (`model/`). Global graph renders all edges across all papers simultaneously.

## Quartz Configuration for TreeWriter

New `quartz/quartz.config.yaml` for this repo (separate from personal vault):

```yaml
configuration:
  pageTitle: "AC Scientific Papers"
  baseUrl: localhost:8888
  enableSPA: true
  enablePopovers: true
  ignorePatterns:
    - ".comments"   # hide comment metadata files
    - "templates"

plugins:
  - source: github:quartz-community/obsidian-flavored-markdown
    enabled: true
    options:
      wikilinks: true
      callouts: true
      mermaid: true
      parseTags: true

  - source: github:quartz-community/graph-view
    enabled: true
    options:
      depth: 2             # local graph depth
      repelForce: 0.5
      centerForce: 0.3
      linkDistance: 30
      fontSize: 0.6
      focusOnHover: true

  - source: github:quartz-community/full-text-search
    enabled: true

  - source: github:quartz-community/backlinks
    enabled: true

  - source: github:quartz-community/tags-explorer
    enabled: true
```

## Local Dev Setup

```bash
# One-time: create Quartz instance in repo
cd /path/to/TreeWriterGit
npx create-quartz@latest quartz
ln -s ../model quartz/content   # symlink model/ as content

# Run alongside TreeWriter
pnpm dev          # TreeWriter on 5173 + 4000
cd quartz && npx quartz build --serve --port 8888   # Quartz on 8888
```

Add to root `package.json`:
```json
{
  "scripts": {
    "dev": "pnpm --dir view dev & cd quartz && npx quartz build --serve --port 8888",
    "build": "pnpm --dir view build && cd quartz && npx quartz build"
  }
}
```

## Communication: Quartz → TreeWriter Editor

When user navigates Quartz to a note, the editor panel should load that file for editing. Two options:

**Option A (simpler): URL parameter**
Quartz page URL: `localhost:8888/papers/ml-study/drafts/introduction-v2`
TreeWriter reads current Quartz URL via `window.opener` or shared `localStorage`:

```typescript
// In TreeWriter frontend
window.addEventListener('storage', (e) => {
  if (e.key === 'quartz:currentPath') {
    setCurrentFile(e.newValue);
  }
});
```

Quartz injects a small script on page load that writes to localStorage:
```javascript
localStorage.setItem('quartz:currentPath', window.location.pathname);
```

**Option B (richer): Embed Quartz in iframe**
TreeWriter frontend embeds Quartz in left panel via `<iframe src="http://localhost:8888">`.
Uses `postMessage` to receive navigation events.
Quartz injects: `window.parent.postMessage({type:'navigate', path}, '*')`.

Option B gives the unified single-window UX. Option A is simpler for v1.

## Hosting for Collaborators

Quartz builds to `public/` — a static site. No server needed for reading.

**Internal team:** `npx quartz build --serve` on any machine, share local URL.

**Remote collaborators:** Push `public/` to GitHub Pages or Cloudflare Pages. Everyone sees the latest graph without running anything locally. Updates on every Git push (CI/CD: build Quartz in GitHub Actions).

**Overleaf users:** they get the Overleaf PDF. Graph is for the AI-native authors.
