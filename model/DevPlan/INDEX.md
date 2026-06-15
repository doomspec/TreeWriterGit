---
title: Scientific Paper Collaborative Writing — Development Plan
summary: Transform TreeWriterGit into a hybrid Overleaf + AI-assisted scientific paper writing platform for multi-author collaboration.
composed_at_commit: null
---

# Scientific Paper Collaborative Writing — Development Plan

**Branch:** `iy_dev`  
**Author:** Ilya Kavets (Acceleration Consortium / University of Toronto)  
**Goal:** Replace the fragmented Overleaf + Claude Code workflow with a unified platform where human collaborators work in LaTeX/Overleaf and AI assistants work in Markdown — synced, version-controlled, and Git-native.

## Problem Statement

Current workflow is split across three tools with no integration:

- **Overleaf** — human collaborators write and comment in LaTeX; no AI integration; isolated from code/data
- **Claude Code** — AI writes in Markdown or directly in files; no visibility for collaborators; output must be manually pasted
- **TreeWriterGit** — Git-native Markdown editor; no LaTeX export; no Overleaf sync; no collaborative comments

The gap: human collaborators who prefer Overleaf cannot see AI-generated drafts in real time. AI cannot see Overleaf comments and edits. There is no shared source of truth.

## Vision

```
model/ (Git, Markdown — source of truth)
  ├── outlines/      ← paper structure, section goals, key claims
  ├── notes/         ← research notes, evidence, citations, raw ideas
  ├── drafts/        ← AI-generated section text (Markdown)
  └── final/         ← approved text, ready for LaTeX export

        ↕ pandoc + sync

Overleaf (LaTeX — human-facing view)
  ├── main.tex       ← assembled from model/final/ on export
  ├── comments       ← human reviewer notes flow back as model/notes/
  └── tracked changes ← diff fed back to model/drafts/ for AI revision
```

AI reads `outlines/` + `notes/` → writes to `drafts/` → human approves → moves to `final/` → exports to Overleaf LaTeX.

Human reviewers comment in Overleaf → comments imported as `notes/` items → AI revises `drafts/`.

## Outline

* [Architecture](architecture.md)
* [Phase 0 — Fix Existing Bugs](phase-0-fixes.md)
* [Phase 1 — File CRUD and Search](phase-1-crud.md)
* [Phase 2 — Scientific Paper Model](phase-2-paper-model.md)
* [Phase 3 — LaTeX and Overleaf Integration](phase-3-overleaf.md)
* [Phase 4 — AI Writing Agents](phase-4-ai-agents.md)
* [Phase 5 — Collaborative Review](phase-5-collaboration.md)
* [Technical Decisions](technical-decisions.md)
