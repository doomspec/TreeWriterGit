---
title: System Architecture
summary: Full data flow and component map for the hybrid TreeWriter + Overleaf + AI writing platform.
composed_at_commit: null
---

# System Architecture

## Component Map

```
┌──────────────────────────────────────────────────────────────────────┐
│              model/ (Git, Markdown + wikilinks)                      │
│                                                                      │
│  papers/{slug}/                          shared/                     │
│  ├── outlines/  ← goals, claims, budget  ├── abbreviations.md        │
│  ├── notes/     ← lit, data, feedback    ├── authors.md              │
│  ├── drafts/    ← AI-written, versioned  └── bibliography.md         │
│  └── final/     ← approved, LaTeX-ready                              │
│                                                                      │
│  Wikilinks: [[introduction]] [[notes/lit/hemocytometer]] [[methods]] │
└──────┬──────────────────────────────────────────────┬───────────────┘
       │  symlink: quartz/content → model/            │  file watch
       ▼                                              ▼
┌──────────────────────────┐          ┌───────────────────────────────┐
│  Quartz (port 8888)      │          │  TreeWriter Backend (port 4000)│
│  READ / NAVIGATE layer   │  ←→URL→  │  WRITE / AGENT layer          │
│                          │          │                               │
│  Global graph view:      │          │  Git sync (120s auto-commit)  │
│  all papers, sections,   │          │  File CRUD API                │
│  notes, figures as nodes │          │  Terminal PTY (xterm.js)      │
│                          │          │  AI Dispatch panel            │
│  Local graph:            │          │  Export (pandoc → .tex)       │
│  per-note connections    │          │                               │
│                          │          │  AI providers:                │
│  Backlinks panel         │          │  ├── Claude Code              │
│  Full-text search        │          │  ├── Codex CLI                │
│  Tags (status, journal)  │          │  ├── Aider                    │
│  Figure embedding        │          │  └── Custom (config)          │
└──────────────────────────┘          └───────────────┬───────────────┘
                                                      │  pandoc export
                                                      ▼
                                      ┌───────────────────────────────┐
                                      │  Overleaf (LaTeX)             │
                                      │  Human collaborators          │
                                      │  ↓ comments import back ↓     │
                                      │  model/notes/feedback/        │
                                      └───────────────────────────────┘
```

## Data Flow: Writing a Section

1. Author creates `outlines/introduction.md` — section goal, key claims, ~500 words budget
2. Author adds research notes to `notes/background-reading.md` — citations, key findings, evidence
3. AI agent reads both → writes `drafts/introduction.md`
4. Author reviews draft in TreeWriter UI — edits inline or adds revision notes
5. If revision needed: notes added to `notes/introduction-revisions.md` → AI re-drafts
6. Once approved: file moves to `final/introduction.md`
7. Export triggered: `pandoc` assembles `final/*.md` → `main.tex` in order defined by outline
8. LaTeX pushed to Overleaf (via Overleaf Git bridge or API)
9. Collaborators comment in Overleaf
10. Comments scraped/imported → `notes/overleaf-feedback-YYYY-MM-DD.md`
11. Loop back to step 5

## Data Flow: Comment Integration

```
Overleaf comment → import script → notes/overleaf-feedback.md
                                         ↓
                              AI reads feedback + draft
                                         ↓
                              AI writes drafts/section-v2.md
                                         ↓
                              Human approves → final/
```

## Model Directory Conventions

Recursive section→unit tree (canonical detail in [[phase-2-paper-model]]):

```
model/
├── papers/
│   └── {paper-slug}/
│       ├── INDEX.md                  ← paper meta + section_order + thesis
│       ├── sections/
│       │   ├── INDEX.md              ← ordered sections
│       │   ├── introduction/
│       │   │   ├── INDEX.md          ← section idea + child_order + cross-links
│       │   │   ├── problem/          ← unit (leaf)
│       │   │   │   ├── INDEX.md      ← idea (the "comment") + status + links
│       │   │   │   └── draft.md      ← generated, editable text
│       │   │   └── contribution/ …
│       │   ├── methods/
│       │   │   └── cell-culture/     ← subsection (container, recursive)
│       │   │       └── seeding/      ← unit (INDEX.md + draft.md)
│       │   ├── results/ …  ├── discussion/ …  └── supporting-information/ …
│       │   └── .comments/            ← comment sidecars for any INDEX.md / draft.md
│       └── notes/
│           ├── literature/  ├── data/  └── feedback/
├── templates/   ← per-journal section sets (nature, cell, plos-one)
└── shared/      ← abbreviations, authors, bibliography
```

Container nodes (paper/section/subsection) order children via `child_order`; unit nodes hold idea (`INDEX.md`) + text (`draft.md`) with a `status` flag (outline→drafted→approved) that replaces a separate `final/` dir.

## Key Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Source of truth | Git Markdown + wikilinks | Version history, diff, graph indexing |
| Navigation UI | Native d3 graph panel in React | Live + queryable; Quartz run as a server rejected ([[tool-assessment]]) |
| LaTeX export | pandoc | Battle-tested, handles citations, cross-refs |
| Overleaf sync | Git bridge (Overleaf premium) or file upload API | Preserves Overleaf UX for non-technical collaborators |
| AI interface | Terminal PTY + UI dispatch panel | Any CLI AI; UI builds prompt from model context |
| AI providers | Configurable (Claude Code, Codex, Aider, custom) | No lock-in; swap AI per task |
| Cross-branch links | Wikilinks `[[...]]` → `/api/model/graph` | Native parser builds adjacency; graph renders edges |
| Unit lifecycle | `status` flag per unit (outline→drafted→approved) | Replaces separate drafts/final dirs |
| Comment storage | `.comments/` sidecar on any file | Comments on both idea + text; never pollutes content |
| Order | `section_order` (paper) + `child_order` (container) | Editorial order, separate from filesystem; drives export |
| Static share | Quartz `build` on-demand → GitHub Pages | Read-only handoff for remote reviewers; not in dev loop |

## Port Map

| Service | Port | Purpose |
|---------|------|---------|
| Quartz | 8888 | Read / navigate / graph |
| TreeWriter frontend | 5173 | Edit + AI dispatch panel |
| TreeWriter backend | 4000 | API + terminal PTY + Git sync |
