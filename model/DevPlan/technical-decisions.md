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

## TD-4: Claude Code via terminal, not API

**Decision:** AI agents run as `claude` CLI processes spawned in the TreeWriter terminal, not via direct Anthropic API calls.

**Rationale:**
- Claude Code has file read/write tools, search, and multi-file context built in
- No API key management needed in the server
- Agents can autonomously traverse `model/` without being told exact file paths
- The terminal is already there — zero new infrastructure

**Tradeoff:** Less programmatic control than direct API calls. Streaming output to frontend is text-only. Acceptable for v1.

## TD-5: section_order in INDEX.md, not filesystem naming

**Decision:** Section order for LaTeX assembly defined by `section_order` list in paper INDEX.md, not by numeric filename prefixes (`01-intro.md`).

**Rationale:**
- Filenames stay readable (`introduction.md`) not `01-introduction.md`
- Order can be changed by editing INDEX.md without renaming files
- Consistent with TreeWriter's existing INDEX.md semantics

**Implementation:** export script reads `section_order` array, assembles in that order.

## TD-6: Comments stored outside model content files

**Decision:** Comments stored in `model/.comments/{file}.comments.json`, not embedded in Markdown.

**Rationale:**
- Embedding comments in Markdown (e.g. HTML comments `<!-- comment -->`) pollutes the text that AI reads
- AI agents should read clean content, not comment noise
- Comments are metadata, not content

**Alternative considered:** a separate `comments/` branch. Rejected — too complex for a small team.

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
| xelatex | LaTeX → PDF | `brew install --cask mactex` |
| overleaf-sync (optional) | Overleaf API sync | `pip install overleaf-sync` |
| claude CLI | AI agent runner | Already installed |
| pnpm | Package manager | Already installed |
| python3 | PTY bridge + import scripts | Already installed |
