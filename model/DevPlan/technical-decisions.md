---
title: Technical Decisions
summary: Key architectural choices, tradeoffs, and rationale for the scientific writing platform build.
composed_at_commit: null
---

# Technical Decisions

## TD-1: Markdown as source of truth, not LaTeX

**Decision:** All writing happens in Markdown. LaTeX is an output format only.

**Rationale:**
- Markdown is what Claude Code generates naturally
- Pandoc handles MD → LaTeX conversion with high fidelity for most scientific content
- Git diffs of Markdown are readable; LaTeX diffs are noisy
- Non-technical collaborators can read/edit Markdown; LaTeX requires expertise

**Tradeoff:** Complex LaTeX (custom macros, tikz figures, chemical structures) cannot round-trip through Markdown. For those cases, maintain a `raw-latex/` directory for manual LaTeX snippets that get `\input{}`-ed into the final `.tex`.

## TD-2: No database — Git + files only

**Decision:** All state (paper metadata, comments, feedback, status) stored as files in `model/`.

**Rationale:**
- Keeps the original TreeWriter architecture intact
- Everything is version-controlled automatically
- Claude Code agents can read/write everything with standard file tools
- Zero deployment complexity (no PostgreSQL, Redis, etc.)

**Tradeoff:** Comments and presence state can't be truly real-time without a DB. Acceptable for a small team (2–5 collaborators). Revisit at scale.

## TD-3: Overleaf Git Bridge over API scraping

**Decision:** Prefer Overleaf Git Bridge (Premium feature) over automating the Overleaf web UI.

**Rationale:**
- Stable, supported, and fast
- AC institutional subscription very likely includes Premium
- Git Bridge exposes Overleaf project as a standard Git remote — trivial to push to

**Fallback:** If not available, use `overleaf-sync` Python package or manual zip upload.

## TD-4: Quartz replaces React navigation UI

**Decision:** Use Quartz as the read/navigate layer. Retain React frontend only for the editor pane and AI dispatch panel.

**Rationale:**
- Quartz graph view is the core differentiator — it shows semantic connections across papers that no custom file tree can
- Wikilinks (`[[note]]`) are the mechanism: zero-cost to add, Quartz indexes them automatically
- Existing quartz-vault at `~/Documents/quartz-vault` proves the setup works; just point Quartz at `model/`
- Quartz builds to static HTML → remote collaborators can browse the graph without running anything (GitHub Pages)
- Saves ~300 lines of React nav code that Quartz obsoletes

**Tradeoff:** Two ports to run locally (5173 editor + 8888 Quartz). Mitigated by embedding Quartz in an iframe in the TreeWriter layout, or accepting two-tab workflow.

**Wikilink convention for cross-paper graph edges:**
- Shared literature: `[[shared/bibliography/hemocytometer-1962]]` — appears in multiple paper graphs
- Shared figures: `[[papers/ml-study/notes/data/fig-time-stats]]` referenced from `[[papers/lh-study]]`
- Methods overlap: `[[papers/ml-study/outlines/methods]]` linked from related paper's intro

## TD-4b: AI provider abstraction, not Claude Code lock-in

**Decision:** AI agents run as CLI processes (Claude Code, Codex, Aider, custom) in the TreeWriter terminal PTY. Provider is user-selectable per-dispatch from the UI panel.

**Rationale:**
- Claude Code: file read/write tools built in, traverses `model/` autonomously
- Codex CLI: OpenAI alternative, same terminal approach
- Aider: strong at multi-file edits, good for revision passes across sections
- No API key in server — user's shell environment provides credentials
- Provider templates configurable in `.treewriter.json` — no code change to add a new AI

**Tradeoff:** Stdout-only streaming. Provider-specific behaviors (Claude writes files itself; Codex outputs to stdout) handled by dispatch logic. Acceptable for v1.

## TD-5: section_order in INDEX.md, not filesystem naming

**Decision:** Section order for LaTeX assembly defined by `section_order` list in paper INDEX.md, not by numeric filename prefixes (`01-intro.md`).

**Rationale:**
- Filenames stay readable (`introduction.md`) not `01-introduction.md`
- Order can be changed by editing INDEX.md without renaming files
- Consistent with TreeWriter's existing INDEX.md semantics

**Implementation:** export script reads `section_order` array, assembles in that order.

## TD-6: Inline comments co-located with manuscript

**Decision:** Review comments are stored as inline `<comment id="…" author="…">text</comment>` tags in the manuscript file. Legacy JSON sidecars under `.comments/` are read as a fallback only.

**Rationale:**
- One-file philosophy: draft content, review notes, and author `\author{}` macros live together
- Comments are stripped before AI dispatch and DOCX export (same pipeline as author notes), so agents still read clean text
- Line-anchored JSON sidecars drift when text moves; inline tags stay attached to spans

**Migration:** `node scripts/migrate-comments-inline.mjs` converts legacy `.comments.json` sidecars.

## TD-6b: Approval provenance in `.approval/` folders

**Decision:** Approved baselines and metadata live in `{unit}/.approval/` (`draft.approved.md`, `draft.yaml`), not in INDEX frontmatter alone.

**Rationale:**
- Keeps `draft.md` body-only while storing content hash, git commit, and approver list
- Hash-based pending detection ignores comment-only edits
- INDEX `status` remains cached for export gating during transition

**Migration:** `node scripts/migrate-approval-layout.mjs` moves legacy `draft.approved.md` files.

## TD-7: No auth for v1

**Decision:** No login system. Identity set by URL param or local storage.

**Rationale:**
- All collaborators are trusted (AC team + invited co-authors)
- Overleaf handles auth for the LaTeX-facing collaborators
- Adding auth adds weeks of work with no security benefit for a closed team

**Revisit:** if the platform is used beyond the immediate team or exposed to public networks.

## Dependency Summary

| Tool | Purpose | Install |
|------|---------|---------|
| pandoc | MD → LaTeX/PDF conversion | `brew install pandoc` |
| tectonic | LaTeX → PDF (preferred) | `brew install tectonic` |
| xelatex / pdflatex / lualatex | LaTeX → PDF (alternative) | `brew install --cask mactex` |
| overleaf-sync (optional) | Overleaf API sync | `pip install overleaf-sync` |
| claude CLI | AI agent runner | Already installed |
| pnpm | Package manager | Already installed |
| python3 | PTY bridge + import scripts | Already installed |
