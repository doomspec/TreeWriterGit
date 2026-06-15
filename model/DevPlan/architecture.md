---
title: System Architecture
summary: Full data flow and component map for the hybrid TreeWriter + Overleaf + AI writing platform.
composed_at_commit: null
---

# System Architecture

## Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     model/ (Git, Markdown)                      │
│                                                                 │
│  outlines/          notes/           drafts/        final/      │
│  ──────────         ──────           ──────          ──────     │
│  paper structure    research         AI-written      approved   │
│  section goals      evidence         section text    text       │
│  key claims         citations        revision log    LaTeX-ready│
│  word budgets       overleaf comments                           │
└───────────┬────────────────┬──────────────────┬────────────────┘
            │                │                  │
            ▼                ▼                  ▼
     ┌─────────────┐  ┌────────────┐   ┌──────────────────┐
     │ TreeWriter  │  │ Claude Code│   │  LaTeX Export    │
     │ UI (5173)   │  │  Agents    │   │  (pandoc)        │
     │             │  │            │   │                  │
     │ Human view: │  │ reads:     │   │ model/final/ →   │
     │ edit notes  │  │ outlines + │   │ sections.tex     │
     │ approve     │  │ notes      │   │ main.tex         │
     │ drafts      │  │ writes:    │   │ bibliography.bib │
     │ manage      │  │ drafts/    │   └────────┬─────────┘
     │ structure   │  │ revisions  │            │
     └─────────────┘  └────────────┘            │
                                                ▼
                                    ┌─────────────────────┐
                                    │  Overleaf (LaTeX)   │
                                    │                     │
                                    │  Human collaborator │
                                    │  views + comments   │
                                    │  tracked changes    │
                                    │  ↓ sync back ↓      │
                                    │  model/notes/       │
                                    │  overleaf-comments/ │
                                    └─────────────────────┘
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
| Source of truth | Git Markdown | Version history, diff, multi-agent access |
| LaTeX export | pandoc | Battle-tested, handles citations, cross-refs |
| Overleaf sync | Git bridge (Overleaf premium) or file upload API | Preserves Overleaf UX for non-technical collaborators |
| AI interface | Claude Code via terminal | Already integrated in TreeWriter terminal |
| Comment import | Python script → model/notes/ | Simple, auditable, no vendor lock |
| Section order | INDEX.md outline order | Single source for document structure |
