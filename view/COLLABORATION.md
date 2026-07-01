# TreeWriter collaboration guide

TreeWriter is **Git-first**: the `model/` directory is the source of truth. The UI helps authors edit Markdown, approve drafts, and export to LaTeX/Overleaf — but long-term collaboration happens through Git branches, review, and merge.

## Model conventions

- **Papers** live under `model/papers/{slug}/` with `INDEX.md` (metadata), `outline.md`, and optional `section_order`.
- **Units** are folders with `INDEX.md`, `outline.md`, and `draft.md`. Approved baselines and provenance live in a co-located **`.approval/`** folder:
  - `.approval/draft.approved.md` / `.approval/outline.approved.md` — last approved body snapshot
  - `.approval/draft.yaml` / `.approval/outline.yaml` — content hash, git commit, approvers, edit/AI metadata
- **Assets** (figures, tables, equations) are folders with `INDEX.md` fields such as `figure_label`, `table_label`, and `equation_label` for cross-references.
- **Comments** are inline `<comment id="…" author="…">text</comment>` tags in the manuscript. They are stripped before AI dispatch and DOCX export (same as `\author{}` notes).

## Approval layout

Each unit/section directory that tracks drafts may contain:

```
papers/{slug}/intro/background/
  INDEX.md
  draft.md
  outline.md
  .approval/
    draft.yaml
    draft.approved.md
    outline.yaml
    outline.approved.md
```

| Field (draft.yaml) | Purpose |
|--------------------|---------|
| `content_hash` | SHA-256 of normalized manuscript (comments/author notes stripped) |
| `git_commit` | Repo HEAD at approve time (best-effort) |
| `approved_by` / `approvers` | Last approver and full sign-off list |
| `edited_by`, `ai_assisted`, `ai_provider` | Pending edit attribution |
| `status` | `approved`, `drafted`, or `outline` (cached in INDEX during transition) |

Legacy top-level `draft.approved.md` files are still read as a fallback until migrated. Run `node scripts/migrate-approval-layout.mjs [modelRoot]` to move them into `.approval/`.

## Inline comments

Review comments use XML-style tags embedded in the manuscript:

```markdown
Some text <comment id="41ce3963" author="yakavetsiv">should be present tense</comment> here.
```

Supported attributes: `id`, `author`, `resolved="true"`, `assigned_to`, `assigned_by`, `assigned_at`.

Legacy JSON sidecars under `.comments/` are read as a fallback when no inline tags exist. Run `node scripts/migrate-comments-inline.mjs [modelRoot]` to convert them.

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
5. **Review approvals** — `.approval/*.yaml` tracks hash, git commit, and approvers; INDEX `status` remains the export gate during transition.
6. **Overleaf** — push modular LaTeX export; external co-authors edit in Overleaf; pull/merge back via Git.

## Presence and comments

- **Presence** is advisory (in-memory, single server process). Do not rely on it for locking.
- **Comments** attach inline via `<comment>` tags; the comments panel reads/writes them through the same REST API.
- **Comment assignment** (optional per comment):
  - `assigned_to` attribute: `human:id:label` or `ai:id:label`
  - `assigned_by`, `assigned_at` — audit attributes on the tag
  - Assignment is **tracking only**; it does not auto-run agent dispatch
  - Filter in the comments panel: All · Assigned to me · Assigned to AI · Unassigned
  - Paper summary API returns `{ unresolved, total, assigned, assignedUnresolved }`
  - `GET /api/comments/assigned?paperSlug=…` lists assigned comments; optional `assigneeType` / `assigneeId` filters
- **Comment cache behavior** — the UI reloads comments when the file path changes or when `refreshVersion` bumps (model tree reload, WebSocket `comments-changed`, or local create/update/delete).
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
