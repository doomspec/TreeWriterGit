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

```
model/
├── papers/
│   └── {paper-slug}/
│       ├── INDEX.md          ← paper metadata (title, journal, authors, status)
│       ├── outlines/
│       │   ├── INDEX.md      ← full paper outline, section order
│       │   ├── abstract.md   ← 150 word target, key contribution
│       │   ├── intro.md      ← narrative arc, citations to hit
│       │   ├── methods.md    ← protocol description goals
│       │   ├── results.md    ← figures to reference, claims to make
│       │   └── discussion.md ← interpretation, limitations, future work
│       ├── notes/
│       │   ├── literature/   ← annotated bibliography entries
│       │   ├── data/         ← links to figures, stats, CSV summaries
│       │   └── feedback/     ← imported Overleaf comments, reviewer notes
│       ├── drafts/
│       │   └── {section}-v{N}.md  ← AI-generated, versioned
│       └── final/
│           └── {section}.md  ← approved, exported to LaTeX
├── templates/
│   ├── nature.md             ← Nature journal outline template
│   ├── cell.md               ← Cell journal outline template
│   └── plos-one.md           ← PLOS ONE template
└── shared/
    ├── abbreviations.md      ← consistent terminology
    ├── authors.md            ← author list + affiliations
    └── bibliography.md       ← shared reference pool
```

## Key Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Source of truth | Git Markdown + wikilinks | Version history, diff, graph indexing |
| Navigation UI | Quartz (replaces React nav) | Graph view, backlinks, search — already built |
| LaTeX export | pandoc | Battle-tested, handles citations, cross-refs |
| Overleaf sync | Git bridge (Overleaf premium) or file upload API | Preserves Overleaf UX for non-technical collaborators |
| AI interface | Terminal PTY + UI dispatch panel | Any CLI AI; UI builds prompt from model context |
| AI providers | Configurable (Claude Code, Codex, Aider, custom) | No lock-in; swap AI per task |
| Cross-paper links | Wikilinks `[[...]]` | Quartz graph renders edges automatically |
| Comment import | Python script → model/notes/feedback/ | Simple, auditable, no vendor lock |
| Section order | `section_order` in paper INDEX.md | Separate from filesystem; controls pandoc assembly |
| Graph hosting | Quartz → public/ → GitHub Pages / Cloudflare | Collaborators read without running anything |

## Port Map

| Service | Port | Purpose |
|---------|------|---------|
| Quartz | 8888 | Read / navigate / graph |
| TreeWriter frontend | 5173 | Edit + AI dispatch panel |
| TreeWriter backend | 4000 | API + terminal PTY + Git sync |
