# Main Content Area

## Current implementation (2026)

The center workspace uses a **hybrid browse/edit** pattern:

**Folder browse (no file open):** [`FolderBrowse`](../../view/frontend/src/components/nav/FolderBrowse.tsx) shows:

* **INDEX hero card** — title and summary from `INDEX.md` frontmatter (or `## Summary` body)
* **Outline links** — parsed from the `## Outline` section
* **Child cards** — one card per directory/file, ordered by `child_order` / `section_order`
* **Reorder** — up/down controls on directory cards call `POST /api/model/reorder`
* **Stale INDEX badge** — shown when `composed_at_commit` is missing
* **Refresh INDEX** — dispatches AI agent to regenerate `INDEX.md` from children

**File edit (file open):** [`EditorWorkspace`](../../view/frontend/src/components/editor/EditorWorkspace.tsx) provides Overleaf-style **Source / Split / Preview** editing with autosave.

## Original spec (card grid)

For each folder:

* Display the title and summary from its `INDEX.md`.
* Show the folder's outline.
* Allow users to expand or collapse child sections on demand.
* Support recursive navigation through the document hierarchy.
* Provide interfaces, such as buttons, for the user to create, delete, group, and reorder Markdown files.
* Use alphabetic order by default for reordering, and add number-based indexing when the user changes it.
* Ensure all file moving and creation is tracked by Git.

The hybrid UI satisfies this spec at folder level while keeping a dedicated editor for units and files.
