# Bug fix verification guide (Overleaf repo)

Use this checklist to verify fixes from the **TreeWriterGit polish pass** (`iy_dev`, PR #3) against your **TreeWriterGitOverleaf** working tree.

**Reference implementation:** [TreeWriterGit](https://github.com/doomspec/TreeWriterGit) commits `ae7015f` … `b137940`.

> **2026-07-04 sync:** Finished Overleaf code (`iy_dev` @ `ab2bd98`) was copied into TreeWriterGit — frontend, backend, `.treewriter-skills/`, and `model/papers/treewriter-guide/`. Verification: `pnpm --dir view typecheck` ✓, backend 495/495 ✓, frontend 837/837 ✓, layout e2e 7/7 ✓.

**How to run Overleaf locally:**

```sh
cd ~/Documents/Github/TreeWriterGitOverleaf/view
pnpm dev
# → http://localhost:5173  (backend :4000)
```

---

## Status at a glance

| # | Bug | Fixed in TreeWriterGit? | Likely still broken in Overleaf? |
|---|-----|-------------------------|----------------------------------|
| 1 | Section file opens plain editor instead of section view | Yes | **No** (synced) |
| 2 | Back button leaves you in wrong folder | Yes | **No** (synced) |
| 3 | Stale back path after navigating elsewhere | Yes | **No** (synced) |
| 4 | `model/TreeWriter/` meta docs open unit editor | Yes (model + routing) | **No** (synced) |
| 5 | `.approval` in child ordering walks | Yes (backend) | **No** (synced) |
| 6 | Legacy `*.approved.md` beside `.approval/` | Yes (treewriter-guide) | Check per unit |
| 7 | Header logo misaligned with sidebar rail | Yes | **No** (PanelNav + brand rail synced) |

---

## 1. Section workspace bypass

**Symptom:** Opening a section’s `outline.md` or `draft.md` (e.g. `papers/treewriter-guide/structure/outline.md`) shows the **unit-style** editor (`EditorWorkspace`) — single file panes, no composed section draft, no “approve children” chrome.

**Root cause:** `WorkspaceRouter` checked `unitPath || activeFile` **before** `sectionPath`, so any open file skipped `SectionWorkspace`.

**Verify in Overleaf (bug still present if unfixed):**

1. Papers → **TreeWriter Guide** → open section **Structure** (or click `structure/outline.md` in the tree).
2. **Broken:** You see a simple outline/draft editor only.
3. **Fixed:** You see **SectionWorkspace** — composed draft preview, section-level approve/dispatch UI, child unit list.

**Code to compare:**

- Overleaf: `view/frontend/src/components/workspace/WorkspaceRouter.tsx` lines ~92–125 (`activeFile` branch before `sectionPath`).
- TreeWriterGit: uses `resolveWorkspaceView()` — section checked before generic editor.

---

## 2. Back button does not restore browse path

**Symptom:** From a **section view**, open a **child unit** file. Click the header **back** arrow. The file closes but you remain inside the unit folder (or outline re-opens), not the section browse path.

**Root cause:** `backToSectionView()` only called `setActiveFile(null)`; `openFile()` had moved `browsePath` into the unit folder.

**Verify in Overleaf:**

1. Navigate to `papers/treewriter-guide/structure`.
2. Open a unit under Structure (e.g. **Building structure** → its outline).
3. Click **Back to section view** (header back).
4. **Broken:** Browse path stays on the unit; section tree context feels wrong.
5. **Fixed:** Returns to `papers/treewriter-guide/structure` with section view (no unit file focused).

**Code to compare:**

- Overleaf: `view/frontend/src/lib/useWorkspaceNavigation.ts` — `backToSectionView` only clears `activeFile`.
- TreeWriterGit: saves `focusReturnPathRef` in `openFile`, restores in `backToSectionView`.

---

## 3. Stale back path after sidebar navigation

**Symptom:** Open a unit from section A, navigate to section B via sidebar/breadcrumbs, open section B’s outline, press back — you jump to section A’s folder.

**Root cause:** `focusReturnPathRef` was not cleared on `navigateTo` / tab change.

**Verify in Overleaf (after fix #2 is ported):**

1. Section **Structure** → open any unit file.
2. Navigate to section **Quick start** (sidebar or tree).
3. Open `quick-start/outline.md`.
4. Press back.
5. **Broken:** Lands back in Structure (or wrong section).
6. **Fixed:** Back clears file only; stays in Quick start section context.

**Code:** TreeWriterGit clears ref in `navigateTo` and `handleSidebarTabChange`.

---

## 4. Meta docs in `model/TreeWriter/` mis-routed

**Symptom:** In Explorer or model tree, open `TreeWriter/application-shape.md`. App shows **unit** editor (outline + draft panes) instead of a single markdown file.

**Root cause:** `model/TreeWriter/INDEX.md` had no `kind:` but contained `outline.md`, so `isUnitFolder()` treated the folder as a manuscript unit.

**Verify in Overleaf:**

1. Browse to `TreeWriter/` (not under Papers).
2. Click **application-shape.md** (or `model-directory.md`).
3. **Broken:** Dual-pane unit editor; wrong chrome.
4. **Fixed:** Single-file markdown editor; folder behaves as a **section/container** browse node.

**Model fix (TreeWriterGit):**

- `model/TreeWriter/INDEX.md` → `kind: section`, `child_order` for loose docs.
- Removed stray `model/TreeWriter/outline.md`.

Overleaf still has `outline.md` and no `kind:` in INDEX — expect bug **#4** until model is updated.

---

## 5. Backend skips `.approval` in ordering

**Symptom:** `.approval` could appear in derived child order / export walks (edge case after layout migration).

**Verify:** Low visibility in UI; mainly affects ordering consistency.

**Code to compare:**

- TreeWriterGit: `.approval` in `SKIP_CHILDREN` (`view/backend/src/model/ordering.ts`) and `CONTAINER_SKIP` (`papers.ts`).
- Overleaf: grep for `.approval` in those files — likely absent.

**Smoke test:** Approve a unit in treewriter-guide; export with “approved only” — snapshot should resolve under `{unit}/.approval/draft.approved.md`.

---

## 6. treewriter-guide approval layout

**Symptom:** Duplicate approval files — `{unit}/draft.approved.md` **and** `{unit}/.approval/draft.approved.md` — can drift.

**TreeWriterGit fix:** Ran `scripts/migrate-approval-layout.mjs`; removed legacy root `*.approved.md` under treewriter-guide (and roboculture).

**Verify in Overleaf repo (filesystem):**

```sh
# Should return nothing (only .approval/ copies allowed)
find model/papers/treewriter-guide -name '*.approved.md' ! -path '*/.approval/*'
```

Overleaf glob suggests units already use `.approval/` only — still worth running the `find` above.

**Runtime:** Open a guide unit → approve → reload → approval badge still correct; export gate unchanged.

---

## 7. Header logo aligned with sidebar rail

**Symptom:** Tree logo in header sat ~16px from the left; sidebar icon rail starts at 0 — visually misaligned.

**Verify visually (all widths):**

| Viewport | Check |
|----------|--------|
| 390px (mobile) | Logo centered over icon rail; no horizontal scroll |
| 768px (tablet) | Same |
| 1280px+ (desktop) | Same; header actions not clipped when AI panel open |

Overleaf has `app-chrome-header__brand-rail` CSS — alignment may already match. Compare logo center to first sidebar column (~36px / `w-9`).

**Automated (TreeWriterGit only):**

```sh
cd view/frontend
TREEWRITER_LAYOUT_BASE=http://127.0.0.1:5173 \
  pnpm exec playwright test e2e/layout-chrome.spec.ts -c playwright.layout.config.ts
```

Port tests to Overleaf or run manually using the table above.

---

## Quick regression pass (5 minutes)

1. **Section view** — treewriter-guide → Structure → confirm section workspace (#1).
2. **Back nav** — open unit from section → back → correct folder (#2).
3. **Meta doc** — `TreeWriter/application-shape.md` → plain editor (#4).
4. **Logo** — header tree icon lines up with sidebar icons (#7).
5. **Approve + export** — one guide unit; export uses `.approval/` snapshot (#5–6).

---

## Porting fixes into Overleaf

If verification shows bugs still present, cherry-pick or manually apply from TreeWriterGit `iy_dev`:

| Fix | Primary files |
|-----|----------------|
| Routing | `view/frontend/src/lib/resolveWorkspaceView.ts`, `WorkspaceRouter.tsx`, tests |
| Back nav | `view/frontend/src/lib/useWorkspaceNavigation.ts` |
| Meta docs | `model/TreeWriter/INDEX.md`, delete `outline.md` |
| Backend skip | `view/backend/src/model/ordering.ts`, `papers.ts` |
| Approval model | `scripts/migrate-approval-layout.mjs` on `model/papers/treewriter-guide/` |
| Layout tests | `view/frontend/e2e/layout-chrome.spec.ts`, `playwright.layout.config.ts` |

---

*Generated from TreeWriterGit polish pass, July 2026.*
