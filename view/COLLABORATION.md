# TreeWriter collaboration guide

TreeWriter is **Git-first**: the `model/` directory is the source of truth. The UI helps authors edit Markdown, approve drafts, and export to LaTeX/Overleaf — but long-term collaboration happens through Git branches, review, and merge.

## Model conventions

- **Papers** live under `model/papers/{slug}/` with `INDEX.md` (metadata), `outline.md`, and optional `section_order`.
- **Units** are folders with `INDEX.md`, `outline.md`, and `draft.md`. Approved baselines are stored in `draft.approved.md` / `outline.approved.md`.
- **Assets** (figures, tables, equations) are folders with `INDEX.md` fields such as `figure_label`, `table_label`, and `equation_label` for cross-references.
- **Comments** are JSON sidecars under `.comments/` mirroring the markdown path (flat papers: `papers/{slug}/.comments/...`; nested: `papers/{slug}/sections/.comments/...`).

## Comment sidecar layout and fallback

Canonical sidecar paths follow the paper layout:

| Manuscript path | Sidecar path |
|-----------------|--------------|
| `papers/{slug}/intro/draft.md` (flat) | `papers/{slug}/.comments/intro/draft.md.comments.json` |
| `papers/{slug}/sections/intro/draft.md` (nested) | `papers/{slug}/sections/.comments/intro/draft.md.comments.json` |
| Non-paper paths | `.comments/{path}.comments.json` |

When reading comments, the backend checks the **canonical** sidecar first. If that file is missing or empty, it **falls back** to the alternate layout (flat ↔ nested) so teams can migrate folder structure without losing comment history. New writes always use the canonical path for the current layout.

## `.treewriter.json` team settings

| Field | Purpose |
|-------|---------|
| `gitSync.commitPaths` | Paths auto-committed during background sync (default: `["model"]`) |
| `gitSync.excludePaths` | Paths stashed during sync (default: `["view"]`) |
| `gitSync.autoSync` / `intervalMs` | Background sync toggle and interval |
| `dispatchSkillsEnabled` | Agent dispatch skills available in the UI |
| `aiProviders[]` | Named AI providers for dispatch and **comment assignment** (track-only; no auto-run) |
| `export.blockOnOrphanRefs` | When `true`, block export/Overleaf push if orphan `\\ref{fig:…}` / `\\ref{tab:…}` |
| `export.blockOnUnapproved` | When `true`, block export if unapproved unit drafts remain |
| `export.blockOnMissingCitations` | When `true`, block export if bibliography keys are missing |
| `export.autoExport` | Background export after model changes (respects block flags above) |

Configure commit paths when your team stores assets outside `model/` or needs selective auto-commit.

## Multi-author Git workflow

1. **Branch per author or feature** — e.g. `author/ilya/intro`, `feature/new-figures`.
2. **Edit in TreeWriter** — drafts autosave to `model/`; use approval bars before treating content as final.
3. **Background sync** (optional) — commits configured `commitPaths`, rebases on `origin`, pushes. Local changes outside commit paths are stashed during sync.
4. **Resolve conflicts in Git** — TreeWriter does not provide real-time OT; Git conflict resolution is authoritative.
5. **Review approvals** — `edited_by`, `approved_by`, and `ai_assisted` in INDEX track attribution; export can gate on orphan cross-refs and pending approvals.
6. **Overleaf** — push modular LaTeX export; external co-authors edit in Overleaf; pull/merge back via Git.

## Presence and comments

- **Presence** is advisory (in-memory, single server process). Do not rely on it for locking.
- **Comments** attach to `.md` line numbers; use the comments panel in the editor.
- **Comment assignment** (optional per comment):
  - `assigned_to`: `{ type: "human" | "ai", id, label }` — human GitHub handle or AI provider name from `aiProviders`
  - `assigned_by`, `assigned_at` — audit fields set when assigning
  - Assignment is **tracking only**; it does not auto-run agent dispatch
  - Filter in the comments panel: All · Assigned to me · Assigned to AI · Unassigned
  - Paper summary API returns `{ unresolved, total, assigned, assignedUnresolved }`
  - `GET /api/comments/assigned?paperSlug=…` lists assigned comments; optional `assigneeType` / `assigneeId` filters
- **Comment cache behavior** — the UI does not keep a long-lived comment cache. Each editor pane reloads comments when the file path changes or when `refreshVersion` bumps (model tree reload, WebSocket `comments-changed`, or local create/update/delete). The comments panel refetches on the same signals; optimistic updates apply only until the next reload.
- **WebSocket model events** refresh the tree (`kind: structure`) or editor content (`kind: content`) after external Git changes. Comment mutations broadcast `comments-changed` (path-scoped) without a full tree reload.

## Export gate matrix

Shared type `ExportValidationConfig` (`@treewriter/shared`) defines the three blocking flags. They apply to manual export, batch export, Overleaf push, and auto-export (unless noted).

| Gate | Setting | Violation | HTTP when blocking | Auto-export |
|------|---------|-----------|-------------------|-------------|
| Orphan cross-refs | `blockOnOrphanRefs` | `\\ref{fig:…}` / `\\ref{tab:…}` with no matching asset label | 422 | Skipped; error recorded in auto-export status |
| Missing citations | `blockOnMissingCitations` | `[@cite_key]` not in paper bibliography | 422 | Skipped |
| Unapproved units | `blockOnUnapproved` | Unit with `status` ≠ `approved` | 422 | Skipped |
| Include drafts override | *(request)* `includeDrafts: true` | — | Unapproved gate **not** applied for that request | Respects `export.includeDrafts` team default |

When blocking is **off**, export still succeeds and returns `orphanCrossRefs` / `missingCitations` in the response body where applicable; the export panel surfaces warnings.

Journal-specific LaTeX styling comes from `model/templates/{journal}.md` — see `model/templates/README.md`.

See `view/README.md` for development and CI commands.
