---
title: Phase 5 — Collaborative Review
summary: Multi-author presence, inline comments, approval workflow, and reviewer-facing Overleaf experience.
composed_at_commit: null
---

# Phase 5 — Collaborative Review

**Effort:** 1 week  
**Dependencies:** Phases 1–4 complete

## Personas

| Persona | Tool | Primary action |
|---------|------|----------------|
| **Lead author (AI-native)** | TreeWriter | Manages outlines, triggers agents, approves drafts |
| **Co-author (technical)** | TreeWriter or Overleaf | Edits methods/results, annotates data notes |
| **Collaborator (Overleaf-native)** | Overleaf | Reads final LaTeX, adds inline comments |
| **External reviewer** | Overleaf or PDF | Comments on exported draft |
| **AI agent** | Terminal / API | Drafts, revises, checks citations |

## Inline Comments in TreeWriter

Add a comment layer to `model/` that doesn't modify file content:

**Storage:** `model/.comments/{path}.comments.json`

```json
[
  {
    "id": "abc123",
    "file": "papers/ml-study/drafts/introduction-v2.md",
    "line": 14,
    "author": "Ilya Kavets",
    "text": "Need to cite the 2023 biomanufacturing review here",
    "resolved": false,
    "created_at": "2026-06-15T10:22:00Z"
  }
]
```

**Backend:**
- `GET /api/comments?path=...` — fetch comments for a file
- `POST /api/comments` — create comment
- `PATCH /api/comments/:id` — resolve or edit
- `DELETE /api/comments/:id`

**Frontend:** sidebar gutter on Markdown cards showing comment count; click to expand thread. Comment icon appears at relevant line in preview mode.

Comments sync to Git automatically (they're files in `model/.comments/`). All collaborators see them in real time via `/model-events`.

## Approval Workflow

Section status transitions:

```
outline → drafted → in-review → approved → final
```

Status stored in section file frontmatter: `status: drafted`

**UI affordances:**
- Color-coded status badges on cards
- "Send for review" button → status: in-review + notifies co-authors via terminal message
- "Approve" button (lead author only) → moves file to `final/`, updates status
- Paper dashboard shows completion: `3/6 sections approved`

## Presence (Who Is Editing)

When a user opens a card for editing, backend records:

```typescript
// In-memory (no DB needed for pilot)
const activeEditors: Map<string, { user: string, since: string }> = new Map();

// On card open: POST /api/presence/claim { path, user }
// On card close or 30s timeout: DELETE /api/presence/claim { path }
// GET /api/presence?path= returns current editor if any
```

Frontend shows "Being edited by [name]" banner on a card currently open by another user.

User identity: for now, set via `?user=Ilya` query param or local storage. No auth needed for trusted collaborators.

## Reviewer-Facing Overleaf Flow

For external reviewers who only use Overleaf:

1. Lead author exports `final/` → pushes to Overleaf
2. Reviewer opens Overleaf, reads PDF, adds comments
3. Lead author runs "Import Feedback" → `notes/feedback/` populated
4. Lead author assigns feedback to sections (or AI auto-assigns by matching text)
5. AI revision agent addresses each feedback item
6. Re-export to Overleaf for next review round

**Version labelling:** each Overleaf export tagged with `git describe --tags` so reviewer always knows which version they're commenting on. Tag format: `paper-{slug}-v{N}`.

## Notification System (Minimal)

No email/Slack needed for a small team. TreeWriter footer shows:

- "3 unresolved comments in introduction"
- "Reviewer feedback imported: 7 items (2 unresolved)"
- "intro-v3.md ready for review"

Clicking opens the relevant view. Poll-based, 10s interval (already exists for git sync status).
