---
title: Phase 3 — LaTeX and Overleaf Integration
summary: Export model/final/ to LaTeX via pandoc, sync to Overleaf, and import Overleaf comments back into model/notes/.
composed_at_commit: null
---

# Phase 3 — LaTeX and Overleaf Integration

**Effort:** 3–4 days  
**Dependencies:** Phase 1 (file CRUD), Phase 2 (paper model + section_order metadata)  
**Prerequisite:** `brew install pandoc` on the server machine

## Export Pipeline

### New backend endpoint: POST /api/export/latex

```typescript
// Body: { paperSlug: string, format: "latex" | "pdf" | "docx" }
// 1. Read model/papers/{slug}/INDEX.md → extract section_order
// 2. Collect model/papers/{slug}/final/{sections} in order
// 3. Assemble combined Markdown with section headers
// 4. Run: pandoc combined.md -o output.tex --from markdown --to latex
//         --bibliography model/shared/bibliography.bib
//         --csl templates/{journal}.csl
// 5. Post-process: wrap in journal LaTeX template
// 6. Return: { texPath, pdfPath?, downloadUrl }
```

**Section assembly order** driven by `section_order` in paper INDEX.md — not alphabetical. This matters because `abstract` comes before `introduction` regardless of filesystem sort.

**Citation handling:**
- Notes files in `notes/literature/` contain `cite_key` fields
- Export script collects all cite_keys referenced in `final/` section files
- Generates `.bib` file from `notes/literature/` entries
- Pandoc handles `[@cite_key]` → `\cite{cite_key}` conversion

### Frontend: Export button

In Paper dashboard → "Export" dropdown:
- "Download .tex" → triggers POST, downloads file
- "Download .pdf" → pandoc → xelatex → PDF (requires LaTeX install)
- "Open in Overleaf" → uploads .tex to Overleaf via API (Phase 3b)

## Overleaf Sync (Two Options)

### Option A: Overleaf Git Bridge (Premium)

Overleaf Premium exposes each project as a Git remote. Workflow:

```bash
# One-time setup
git remote add overleaf https://git.overleaf.com/{project_id}

# On export: push LaTeX to Overleaf
pandoc model/papers/ml-study/final/*.md -o /tmp/main.tex
cp /tmp/main.tex /path/to/overleaf-repo/main.tex
git -C /path/to/overleaf-repo add . && git commit -m "Sync from TreeWriter"
git -C /path/to/overleaf-repo push overleaf main
```

Backend stores `overleaf_repo_path` per paper in INDEX.md. Export button triggers this automatically.

### Option B: Overleaf API (v2, any plan)

Overleaf has an undocumented but stable file upload API used by their web UI. Alternatively use `overleaf-toolkit` or the `overleaf-sync` Python package.

```python
# POST to Overleaf project
import requests
session = requests.Session()
session.post("https://www.overleaf.com/login", data={...})
session.post(f"https://www.overleaf.com/project/{project_id}/file",
             files={"qqfile": open("main.tex", "rb")})
```

**Recommendation:** Use Option A if user has Overleaf Premium (AC institutional subscription likely covers this). Fall back to Option B otherwise.

## Comment Import Pipeline

Overleaf stores comments in its internal database — not directly accessible without the API. Two import approaches:

### Approach A: Manual export + parse

Overleaf → "Download → Source" → zip contains `main.tex` with comments as `\TODO{}` or tracked changes as `\DIFadd{}/\DIFdel{}` (latexdiff format).

Script `scripts/import_overleaf_comments.py`:

```python
# Parse \TODO{reviewer}{comment text} from .tex
# OR parse latexdiff \DIFadd / \DIFdel blocks
# Write each as notes/feedback/overleaf-{date}-{n}.md
```

### Approach B: Overleaf API comments endpoint

```
GET https://www.overleaf.com/project/{id}/threads
```

Returns JSON with all comment threads. Script fetches these and writes to `notes/feedback/`.

### Frontend: "Import Overleaf Feedback" button

Paper dashboard → "Import Feedback" → prompts for Overleaf project URL or zip upload → runs import script → shows count of new feedback notes created.

## Bidirectional Edit Flow

Human edits text directly in Overleaf → those changes are in the `.tex` not in `model/final/`. Options:

1. **Accept Overleaf as final for approved text** — only import comments, not full edits. AI never touches `final/` directly.
2. **Pandoc back-convert** — `pandoc main.tex -o final-overleaf.md` to pull edits back into Markdown. Lossy for complex LaTeX.
3. **Lock policy** — once a section moves to `final/`, it lives in both places and humans choose which to treat as authoritative per revision cycle.

**Recommendation:** Option 1 for now. `final/` is the approved Markdown. Overleaf is the presentation layer. Comments flow back as `notes/feedback/`.
