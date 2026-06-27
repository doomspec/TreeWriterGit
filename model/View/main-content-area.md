# Main Content Area

## Current implementation (2026)

The center workspace uses a **hybrid browse/edit** pattern with three file roles per folder:

| File | Visible in UI | Role |
|------|---------------|------|
| **`INDEX.md`** | **Hidden** | Technical metadata: `kind`, `child_order`, `section_order`, `links`, `status`, `composed_at_commit` |
| **`outline.md`** | **Outline** | User-facing section overview — summary, narrative arc, child links |
| **`draft.md`** | **Draft** | Manuscript prose composed into the final paper |

**Folder browse (no file open):** [`FolderBrowse`](../../view/frontend/src/components/nav/FolderBrowse.tsx) reads metadata from `INDEX.md` and displays content from `outline.md`:

* **Outline hero card** — title from INDEX, summary from `outline.md`
* **Outline links** — parsed from `## Outline` in `outline.md`
* **Child cards** — ordered by `child_order` / `section_order` in INDEX
* **Stale outline badge** — when `composed_at_commit` is missing in INDEX
* **Refresh outline** — AI regenerates `outline.md` from children

**Unit / section edit (outline + draft pair):** [`EditorWorkspace`](../../view/frontend/src/components/editor/EditorWorkspace.tsx) shows a **dual-pane** editor when the folder has `outline.md`:

* **Left:** `outline.md` — rendered editing with live preview; **Rendered | Raw** toggle per pane
* **Right:** `draft.md` — same; blank `draft.md` is created automatically when missing
* Autosave on both panes

**Other markdown files:** single editor with Source / Split / Preview toolbar.

AI dispatch:

* **Draft from outline** — reads `outline.md`, writes `draft.md`
* **Sync outline from draft** — reads `draft.md`, updates `outline.md`
* Graph edges — INDEX `links` + `outline.md` structure (not draft prose)

## Original spec (card grid)

For each folder:

* Display the title and summary from its outline.
* Show the folder's outline links and child structure.
* Allow recursive navigation, CRUD, and reorder (tracked in INDEX metadata).
* Ensure all changes are version-controlled in Git.

The hybrid UI satisfies this spec while keeping technical INDEX files out of the author-facing tree.
