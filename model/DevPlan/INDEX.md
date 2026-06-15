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
model/ (Git, Markdown + wikilinks — single source of truth)
  ├── papers/{slug}/
  │   ├── outlines/   ← section goals, key claims, word budgets
  │   ├── notes/      ← literature, data, Overleaf feedback
  │   ├── drafts/     ← AI-generated text (versioned)
  │   └── final/      ← approved, exports to LaTeX
  └── shared/         ← abbreviations, authors, bibliography

        ↕  wikilinks define semantic graph

Quartz (graph view — read/navigate layer)
  ├── global graph    ← all papers, sections, notes as nodes
  ├── local graph     ← per-section: what links to/from this node
  ├── cross-paper     ← shared notes/figures appear in multiple papers
  └── figure nodes    ← data files as navigable graph nodes

        ↕  file watch + rebuild

TreeWriter backend (write/agent layer)
  ├── Git sync (120s auto-commit + push)
  ├── Terminal PTY (any AI CLI: Claude Code, Codex, Cursor, custom)
  ├── AI Dispatch panel (UI → selects section + action → sends to AI)
  └── Export pipeline (pandoc → .tex → Overleaf Git Bridge)

        ↕  comment import

Overleaf (LaTeX — collaborator-facing)
  ├── main.tex        ← assembled from final/ on export
  └── comments        ← imported back as notes/feedback/
```

**Key upgrade:** Quartz replaces the custom React navigation UI. Its graph view navigates both within a paper (outline → draft → final) and across papers (shared methods, figures, literature nodes connected by wikilinks). The existing React frontend shrinks to an editor + AI dispatch panel only.

## Outline

* [Architecture](architecture.md)
* [Quartz Graph Integration](quartz-integration.md)
* [AI Terminal Controls](ai-terminal-controls.md)
* [Phase 0 — Fix Existing Bugs](phase-0-fixes.md)
* [Phase 1 — File CRUD and Search](phase-1-crud.md)
* [Phase 2 — Scientific Paper Model](phase-2-paper-model.md)
* [Phase 3 — LaTeX and Overleaf Integration](phase-3-overleaf.md)
* [Phase 4 — AI Writing Agents](phase-4-ai-agents.md)
* [Phase 5 — Collaborative Review](phase-5-collaboration.md)
* [Technical Decisions](technical-decisions.md)
