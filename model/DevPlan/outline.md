# Scientific Paper Collaborative Writing — Development Plan

**Branch:** `iy_dev`  
**Author:** Ilya Yakavets (Acceleration Consortium / University of Toronto)  
**Goal:** Replace the fragmented Overleaf + Claude Code workflow with a unified platform where human collaborators work in LaTeX/Overleaf and AI assistants work in Markdown — synced, version-controlled, and Git-native.

## Problem Statement

Current workflow is split across three tools with no integration:

- **Overleaf** — human collaborators write and comment in LaTeX; no AI integration; isolated from code/data
- **Claude Code** — AI writes in Markdown or directly in files; no visibility for collaborators; output must be manually pasted
- **TreeWriterGit** — Git-native Markdown editor; no LaTeX export; no Overleaf sync; no collaborative comments

The gap: human collaborators who prefer Overleaf cannot see AI-generated drafts in real time. AI cannot see Overleaf comments and edits. There is no shared source of truth.

## Vision (current model)

```
model/ (Git, Markdown + wikilinks — single source of truth)
  └── papers/{slug}/
        ├── INDEX.md          ← technical metadata (hidden in UI)
        ├── outline.md        ← paper overview
        ├── sections/…        ← or flat section folders (roboculture style)
        │     └── {section}/
        │           ├── outline.md
        │           └── {unit}/outline.md + draft.md
        └── notes/            ← literature, data, feedback

        ↕  wikilinks + INDEX links

TreeWriter view (5173 + 4000)
  ├── Native graph panel (d3) — navigation
  ├── Hybrid browse / dual-pane outline+draft editor
  ├── AI dispatch → terminal
  └── Export (pandoc → .tex / .pdf) — F6 v1

        ↕  optional v1.1

Overleaf (presentation layer)
  ├── main.tex        ← from export
  └── comments        ← import to notes/feedback/
```

> **Historical note:** An earlier plan used flat `outlines/`, `drafts/`, `final/` folders and Quartz as the primary nav layer. The recursive three-file model and native graph replaced that design. See [[phase-2-paper-model]] and [[tool-assessment]].

## Minimal Dev Stack

```
Runs locally:
  TreeWriter backend  (4000) — Git sync, file API, terminal PTY
  TreeWriter frontend (5173) — editor + graph panel + AI dispatch

AI writing (terminal, no extra integration):
  claude skills: wiki-ingest, wiki-query, autoresearch, wiki-lint

On-demand sharing only:
  npx quartz build → static site → GitHub Pages for collaborators
```

**Not running during dev:** Quartz server, PageIndex, separate nav frontend.  
See [[tool-assessment]] for full rationale on PageIndex, claude-obsidian, and Quartz.

## Outline

* [**PRD — Build Authority**](PRD.md) ← code-level spec, grounded in actual repo; supersedes phase docs for implementation
* [Tool Assessment](tool-assessment.md)
* [Architecture](architecture.md)
* [AI Terminal Controls](ai-terminal-controls.md) — **F4 v1 done**
* [Phase 0 — Fix Existing Bugs](phase-0-fixes.md) — **M1 done**
* [Phase 1 — File CRUD and Search](phase-1-crud.md) — **M2 done** (search deferred)
* [Phase 2 — Scientific Paper Model](phase-2-paper-model.md) — **M5 done**
* [Phase 3 — LaTeX and Overleaf Integration](phase-3-overleaf.md) — **M6 export v1 done**; Overleaf v1.1 next
* [Phase 4 — AI Writing Agents](phase-4-ai-agents.md) — **M4 v1 done**
* [Phase 5 — Collaborative Review](phase-5-collaboration.md)
* [Technical Decisions](technical-decisions.md)
* [Quartz Graph Integration](quartz-integration.md) _(reference only — not in dev stack)_
