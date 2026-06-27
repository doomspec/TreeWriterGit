---
title: System Architecture
summary: System map for the TreeWriter scientific-writing platform — recursive paper tree, native React UI, AI dispatch, pandoc export, Overleaf sync.
composed_at_commit: null
---

# System Architecture

> **Authority.** [[DEVELOPMENT]] is the as-built reference (module map, issue catalogue, roadmap). This doc is the high-level system map. [[PRD]] §2 lists capabilities verified against code.

## Component Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│  model/  (Git — Markdown + wikilinks, auto-sync every 120 s)            │
│                                                                         │
│  papers/{slug}/                                                         │
│  ├── INDEX.md              ← paper meta, section_order, overleaf path   │
│  ├── sections/                                                          │
│  │   ├── introduction/     ← container (section / subsection / unit)    │
│  │   │   ├── INDEX.md      ← metadata, child_order, links               │
│  │   │   ├── outline.md    ← idea / overview (steers AI)                │
│  │   │   ├── draft.md      ← manuscript text (exports)                  │
│  │   │   └── .sessions/    ← dispatch audit trail                       │
│  │   └── .comments/        ← sidecar JSON per .md (never in content)    │
│  └── notes/{literature,data,feedback}/                                  │
│                                                                         │
│  templates/{journal}.md    shared/                                      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  fs.watch → /model-events WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TreeWriter  (localhost — no Quartz server in dev loop)               │
│                                                                         │
│  Frontend :5173                    Backend :4000                        │
│  ├── Sidebar (explorer / papers / graph)   ├── REST API (model CRUD)    │
│  ├── FolderBrowse + SectionWorkspace       ├── Git sync loop            │
│  ├── Unit dual-pane (outline + draft)      ├── Terminal PTY (xterm.js)  │
│  ├── GraphPanel (d3-force + d3-zoom)       ├── AI dispatch + sessions   │
│  ├── SearchResults (F2)                    ├── Export (pandoc)         │
│  ├── CommentsPanel + presence banner       ├── Comments / presence API  │
│  └── DispatchPanel + terminal              └── Overleaf push / import   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  pandoc → main.tex (+ references.bib)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Overleaf (presentation layer)                                          │
│  Git Bridge clone at overleaf_repo_path → push main.tex                 │
│  Reviewers comment in Overleaf → Import feedback → notes/feedback/      │
└─────────────────────────────────────────────────────────────────────────┘

Optional (not in dev loop): `npx quartz build` → static site for remote readers.
```

## Data Flow: Writing a Unit

1. Author creates a **unit** under a section (`POST /api/model/node`) → `INDEX.md` + `outline.md` + `draft.md`.
2. Author writes the **idea** in `outline.md` (what the paragraph must say, evidence, tone).
3. Author selects the unit in the UI → **AI dispatch** reads `outline.md`, sibling context, literature notes → writes `draft.md` via terminal provider.
4. Author edits in the **dual-pane editor** (outline left, draft right); inline **comments** attach via `.comments/` sidecar without polluting content.
5. On successful draft/revise session, unit `status` advances `outline → drafted`; author marks `approved` when ready.
6. **Section compose** (`GET /api/model/section-compose`) stitches child summaries + drafts for section-level review.

## Data Flow: Export and Overleaf

1. **Export** walks paper `section_order` → each container's `child_order` → unit `draft.md` (default: `approved` only).
2. **Pandoc** assembles combined Markdown → `main.tex` + `references.bib` from literature notes.
3. **Push Overleaf** copies into the paper's Git Bridge clone, commits, pushes (`POST /api/overleaf/push`).
4. Collaborators review in Overleaf; lead author runs **Import feedback** → parses `\todo` from `main.tex` into `notes/feedback/`.
5. AI **revise** dispatch addresses feedback; loop back to step 4–5.

## Data Flow: Comments and Presence

```
Editor opens draft.md
    ├── POST /api/presence/claim  →  "Being edited by …" banner for others
    ├── GET/POST /api/comments    →  sidecar at sections/.comments/{path}.comments.json
    └── model-events broadcast    →  other clients refresh tree / comment counts
```

User identity is local only (`?user=Name` or `localStorage`). No auth server.

## Model Directory Conventions

Recursive section→unit tree (detail in [[phase-2-paper-model]], as-built in [[DEVELOPMENT]] §4):

```
model/
├── papers/
│   └── {paper-slug}/
│       ├── INDEX.md                  ← paper meta + section_order + thesis
│       ├── sections/
│       │   ├── INDEX.md              ← ordered sections
│       │   ├── introduction/
│       │   │   ├── INDEX.md          ← section idea + child_order + cross-links
│       │   │   ├── outline.md        ← section overview (compose / nav)
│       │   │   ├── problem/          ← unit (leaf)
│       │   │   │   ├── INDEX.md      ← metadata + status + links
│       │   │   │   ├── outline.md    ← paragraph idea (steers AI)
│       │   │   │   └── draft.md      ← generated, editable text
│       │   │   └── contribution/ …
│       │   ├── methods/ …  ├── results/ …  └── supporting-information/ …
│       │   └── .comments/            ← comment sidecars for any INDEX.md / draft.md
│       └── notes/
│           ├── literature/  ├── data/  └── feedback/
├── templates/   ← per-journal section sets (nature, cell, plos-one)
└── shared/      ← abbreviations, authors, bibliography
```

Container nodes order children via `child_order`; unit nodes hold **three files** (`INDEX.md`, `outline.md`, `draft.md`) with a `status` flag (`outline → drafted → approved`) that replaces the old flat `drafts/` / `final/` layout.

## Key Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Source of truth | Git Markdown + wikilinks | Version history, diff, graph indexing |
| Navigation UI | Native d3 graph panel in React | Live + queryable; Quartz-as-server rejected ([[tool-assessment]]) |
| LaTeX export | pandoc | Battle-tested, handles citations, cross-refs |
| Overleaf sync | Git bridge clone + push/import | Preserves Overleaf UX; feedback via `\todo` parse (v1) |
| AI interface | Terminal PTY + UI dispatch panel | Any CLI AI; UI builds prompt from model context |
| AI providers | Configurable (Claude Code, Codex, Aider, custom) | No lock-in; swap AI per task |
| Cross-branch links | Wikilinks `[[...]]` → `/api/model/graph` | Native parser builds adjacency; graph renders edges |
| Unit lifecycle | `status` flag per unit | Replaces separate drafts/final dirs |
| Idea vs text | `outline.md` (idea) + `draft.md` (text) | AI reads idea without polluting export body |
| Comment storage | `.comments/` sidecar on any file | Comments on idea + text; never pollutes content |
| Order | `section_order` (paper) + `child_order` (container) | Editorial order, separate from filesystem; drives export |
| Static share | Quartz `build` on-demand → GitHub Pages | Read-only handoff for remote reviewers; not in dev loop |

## Port Map

| Service | Port | Purpose |
|---------|------|---------|
| TreeWriter frontend | 5173 | Edit, graph, dispatch, comments |
| TreeWriter backend | 4000 | REST API + terminal PTY + git sync + WebSockets |
| Quartz (optional) | 8080 | Static build only — not run during development |

## Related Docs

- [[DEVELOPMENT]] — as-built module map, verified issues, roadmap M1–M11
- [[PRD]] — feature specs, API contract, capability table
- [[phase-2-paper-model]] — frontmatter schemas, wikilink patterns
- [[phase-3-overleaf]] — export and Overleaf integration detail
- [[phase-5-collaboration]] — comments, presence, review workflow
