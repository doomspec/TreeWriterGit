---
title: Phase 4 — AI Writing Agents
summary: Claude Code agents that read outlines and notes, draft sections, revise based on feedback, and check citation completeness.
composed_at_commit: null
---

# Phase 4 — AI Writing Agents

> **Path note:** this doc predates the recursive unit model. The prompt templates and agent roles below are current, but **paths are stale** — wherever it says `outlines/{section}.md` or `drafts/{section}-v{N}.md`, the real targets are a unit's `INDEX.md` (idea) and `draft.md` (text), with `status` instead of `-vN` files. [[phase-2-paper-model]] + [[PRD]] F4 are authoritative.

**Effort:** 3–4 days  
**Dependencies:** Phase 2 (paper model), Phase 3 (export to validate output)

## Agent Architecture

All agents run through the existing TreeWriter terminal (WebSocket PTY). No new infrastructure needed — Claude Code is already available in terminal. What Phase 4 adds: structured prompts, a dispatch endpoint, and result routing back into the model.

## New Backend Endpoint: POST /api/agent/run

```typescript
// Body: {
//   agent: "draft" | "revise" | "citation-check" | "outline-expand",
//   paperSlug: string,
//   section: string,        // e.g. "introduction"
//   options?: {
//     targetWords?: number,
//     tone?: "formal" | "technical",
//     emphasize?: string[]  // key claims to prioritize
//   }
// }
// Spawns claude -p "{prompt}" in terminal working directory
// Streams output via /model-events WebSocket
// Writes result to model/papers/{slug}/drafts/{section}-v{N}.md
```

## Agent 1: Draft Writer

**Trigger:** "Draft this section" button on any outline file  
**Reads:**
- `outlines/{section}.md` — key claims, word budget, `ai_context` field
- `notes/literature/*.md` — available evidence and citations
- `notes/data/*.md` — figures and statistics to reference
- `model/shared/abbreviations.md` — terminology consistency
- `model/templates/{journal}.md` — style guide

**Prompt template (condensed):**

```
You are writing the {section} section of a {journal} paper titled "{title}".

OUTLINE AND GOALS:
{outlines/section.md content}

AVAILABLE EVIDENCE:
{notes/literature/* summaries}

STATISTICS:
{notes/data/* summaries}

STYLE REQUIREMENTS:
- Target: {target_words} words
- Journal: {journal} (see template for style)
- Use [@cite_key] for citations
- Do not invent data or statistics

Write ONLY the section text. No preamble.
```

**Output:** `drafts/{section}-v{N}.md` where N increments automatically

## Agent 2: Revision Agent

**Trigger:** "Revise based on feedback" button (appears when `notes/feedback/` has unresolved items for this section)  
**Reads:**
- `drafts/{section}-v{N}.md` — current draft
- `notes/feedback/*.md` filtered to `section: {section}` and `resolved: false`

**Prompt template:**

```
You are revising the {section} section of a scientific paper.

CURRENT DRAFT:
{drafts/section-vN.md}

REVIEWER FEEDBACK (address each point):
{notes/feedback items for this section}

CONSTRAINTS:
- Keep all factual claims; do not add new data
- Maintain ~{target_words} word count
- Mark which feedback items you addressed in a comment block at the end

Rewrite the section. Then list: "Addressed: [item 1], [item 2]..."
```

**Output:** `drafts/{section}-v{N+1}.md` + marks addressed feedback items as `resolved: true`

## Agent 3: Citation Completeness Check

**Trigger:** "Check citations" button in paper dashboard  
**Reads:** all `final/` and `drafts/` files; `notes/literature/`  
**Does:**

```python
# 1. Extract all [@cite_key] references from draft/final files
# 2. Check each against notes/literature/ — is there an entry?
# 3. For missing entries: report as warnings
# 4. For entries with missing DOI/year/authors: flag as incomplete
# 5. Write report to notes/citation-check-{date}.md
```

**Output:** `notes/citation-check-YYYY-MM-DD.md` with table of missing/incomplete citations

## Agent 4: Outline Expander

**Trigger:** "Expand outline" button on any `outlines/` file  
**Use case:** Author has a rough outline with bullet points; wants AI to expand it into a full structured outline with key claims, evidence pointers, and word budget per subsection

**Reads:** rough outline file + full paper INDEX.md for context  
**Output:** overwrites the outline file with expanded version (asks confirmation first)

## Frontend: Agent Panel

Right sidebar panel (below or replacing terminal when agent is running):

```
┌─────────────────────────────────────┐
│  AI Agent                           │
│  ─────────────────────────────────  │
│  Section: Introduction              │
│  Agent: Draft Writer                │
│  Status: Running... (v3)            │
│                                     │
│  [Cancel]              [View Draft] │
│                                     │
│  Recent runs:                       │
│  ✓ intro-v1.md  2026-06-14 14:22   │
│  ✓ intro-v2.md  2026-06-15 09:11   │
│  → intro-v3.md  running...          │
└─────────────────────────────────────┘
```

## Agent Dispatch via Terminal

Until the `/api/agent/run` endpoint is built, agents can be run manually from the TreeWriter terminal:

```bash
# In TreeWriter terminal (already rooted at model/)
cd ../  # go to repo root
claude -p "$(cat DevPlan/agent-prompts/draft-intro.md)"
# paste output manually into drafts/introduction-v1.md
```

This works today. Phase 4 automates the routing.
