---
title: Phase 1 — File CRUD and Search
summary: Add file/directory create, delete, move, rename, and full-text search. Foundation for all paper management.
composed_at_commit: null
---

# Phase 1 — File CRUD and Search

**Effort:** 2–3 days  
**Prerequisite for:** Phase 2 (paper model needs to create files)

## New Backend Endpoints

### POST /api/model/file — Create file

```typescript
// Body: { path: string, content?: string }
// Creates file + any missing parent dirs
// If path ends in /, creates dir + INDEX.md skeleton
// Broadcasts model-changed
```

### DELETE /api/model/file — Delete file

```typescript
// Query: ?path=papers/ml-study/drafts/intro-v1.md
// Refuses if directory has children
// Hard delete + git rm (picked up by next sync)
```

### POST /api/model/move — Rename or move

```typescript
// Body: { from: string, to: string }
// fs.rename + broadcasts model-changed
// Updates all INDEX.md references to the moved file (grep + replace)
```

### GET /api/model/search — Full-text search

```typescript
// Query: ?q=viability&root=papers/ml-study
// Uses child_process grep -rl --include="*.md"
// Returns: [{ path, excerpt, line }]
// excerpt = 100 chars around match
```

## Frontend Changes

### Sidebar additions

- `[+]` button at folder level → modal: "New file" / "New folder"
- Right-click context menu on tree nodes: Rename, Move, Delete
- Drag-and-drop reorder (updates INDEX.md outline order)

### Search panel

- `Cmd+K` → search overlay
- Results list with file path + excerpt
- Click result → navigates to card

### Card header additions

- Rename button (pencil on file name)
- Delete button (trash, with confirm dialog)

## INDEX.md Auto-Management

When a file is created in a directory, append it to that directory's `INDEX.md` outline:

```markdown
## Outline
* [New Section](new-section.md)   ← appended automatically
```

When a file is deleted, remove its entry. When moved, update the link. This keeps the outline always accurate.
