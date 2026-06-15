---
title: Tool Assessment — PageIndex, claude-obsidian, Quartz
summary: Fit analysis for three candidate tools. Verdict on what to use, borrow, or skip in the minimal dev build.
composed_at_commit: null
---

# Tool Assessment

## TL;DR

| Tool | Use? | How |
|------|------|-----|
| **PageIndex** | Skip for now | OpenAI-only, single-file processing, no directory batch. Claude Code already does context retrieval natively. Revisit for large-scale cross-paper RAG later. |
| **claude-obsidian** | Yes, already installed | Skills (wiki-ingest, wiki-query, autoresearch) run via existing terminal. Use for importing literature + querying vault. No integration work needed. |
| **Quartz** | Borrow D3 graph only | Don't run it as the frontend. Too heavy, static, no editing, no real-time. Borrow: graph visualization approach (D3 force). Use for: read-only export link for remote collaborators. |

---

## PageIndex

**What it does:** Reasoning-based RAG. Indexes a PDF/MD as a hierarchical TOC tree. LLM navigates the tree to find relevant sections — no vector embeddings.

**Fit analysis:**

Good idea, wrong stage:
- Single-file CLI only (`python3 run_pageindex.py --md_path file.md`) — no directory batch support
- Defaults to GPT-4o; Claude integration via LiteLLM but not native
- The problem it solves (finding relevant sections across a large document) doesn't exist at n=1 paper with ~10 sections
- Claude Code already reads multiple files natively when given a directory — no separate RAG layer needed at this scale

**Verdict:** Skip. Revisit when corpus exceeds ~50 files and AI starts losing context. At that point: run PageIndex over `model/papers/` and use its tree as the context input to the AI dispatch prompt.

---

## claude-obsidian (AgriciDaniel)

**What it does:** Obsidian plugin where Claude reads sources → auto-creates wikilinked Markdown pages → maintains a self-organizing knowledge graph. Skills: wiki-ingest, wiki-query, wiki-lint, autoresearch, canvas, think.

**Fit analysis:**

Already installed and working:
- wiki-ingest → drops any source (URL, PDF, text) → Claude extracts entities, writes structured notes with wikilinks into the vault
- wiki-query → answers questions from vault content with page citations
- autoresearch → multi-round web research pipeline → synthesizes into vault notes
- wiki-lint → finds orphaned pages, broken links, gaps

**Directly maps to our paper writing needs:**

| Paper task | Skill |
|-----------|-------|
| Import a paper PDF → notes/literature/ | wiki-ingest |
| "What do we have on hemocytometer error rates?" | wiki-query |
| Research background for a new paper | autoresearch |
| Find broken links between sections | wiki-lint |

**Integration required:** None. These run in the TreeWriter terminal today. The AI dispatch panel just needs buttons that pre-fill the terminal with the right skill invocation.

**One gap:** claude-obsidian targets the personal Obsidian vault at `~/Documents/obsidian/viprorok/`. For paper writing we want it to operate on `model/papers/`. Options:
1. Symlink `model/papers/` into the Obsidian vault (cleanest — vault tools work unchanged)
2. Point skills at `model/` directly via `--vault` param if supported
3. Use both: research in vault → copy approved notes to model/

Option 1 is recommended. Already done for quartz-vault (content symlinks to vault). Same pattern.

---

## Quartz

**What it does:** Static site generator for Markdown knowledge graphs. Builds from a content directory → static HTML with graph view, wikilinks, search, backlinks.

**What it lacks for this project:**

- **Static** — no editing, no real-time updates without rebuild
- **No API** — can't query the graph programmatically; can't inject current-file context into dispatch panel
- **Heavy build system** — adds ~5s rebuild on every file save; not usable as live view during writing
- **No terminal or AI integration** — these would need to be bolted on externally
- **Two-port friction** — developers would juggle Quartz (8888), TreeWriter (5173), backend (4000)

**What's worth borrowing:**

1. **D3 force graph approach** — Quartz uses d3-force for its graph. We can build the same graph in ~150 lines of React + d3 directly in TreeWriter frontend, fed by a new `GET /api/model/graph` endpoint that parses wikilinks.

2. **Wikilink parsing** — simple regex `\[\[([^\]]+)\]\]` on each .md file → adjacency list. No need for Quartz's full build pipeline.

3. **Graph visual design** — node sizing by connection count, hover highlighting, click-to-navigate. Copy the CSS/SVG approach.

4. **Static export for collaborators** — after a paper is ready for review, run `npx quartz build` once to generate a shareable static site. Not part of the dev workflow — just for external sharing.

**Verdict:** Don't run Quartz as part of the development stack. Implement a lightweight graph panel natively in TreeWriter using d3-force (~150 lines). Use Quartz only for one-off static exports.

---

## Revised Minimal Stack

```
Development (what runs locally):
├── TreeWriter backend (port 4000) — Git sync, file API, terminal PTY
├── TreeWriter frontend (port 5173) — editor + lightweight graph panel + AI dispatch
└── model/ — Markdown source (wikilinks define the graph)

AI writing (via terminal, no integration work):
├── claude skills: wiki-ingest, wiki-query, autoresearch, wiki-lint
└── claude -p "..." — direct prompting for draft/revise actions

Sharing (on-demand, not part of dev loop):
└── npx quartz build → public/ → GitHub Pages link for collaborators
```

**What this eliminates from the original plan:**
- Quartz as a running service
- PageIndex indexing pipeline
- Separate navigation frontend
- Multiple ports / iframe communication

**What this adds (small):**
- `GET /api/model/graph` — parse wikilinks, return adjacency JSON (~50 lines)
- Graph panel in TreeWriter React — d3-force visualization (~150 lines)
- AI dispatch panel — dropdown (AI + action) → terminal command (~100 lines)
- Symlink: `model/papers/` → Obsidian vault (one shell command)
