---
title: AI Terminal Controls
summary: UI panel for dispatching any AI CLI (Claude Code, Codex, Cursor, custom) to specific paper sections, with context-aware prompts built from the model structure.
composed_at_commit: null
---

# AI Terminal Controls

## Design Goal

The terminal already exists (xterm.js + PTY). What's missing: **UI controls that construct and fire structured commands** so authors don't need to write prompts manually. Context (which section, which paper, what action) comes from the current Quartz navigation state.

Any AI with a CLI gets a dispatch button. The system doesn't lock to Claude Code.

## Supported AI CLIs

| AI | CLI invocation | Notes |
|----|---------------|-------|
| Claude Code | `claude -p "prompt"` or `claude --continue` | Default; file tools built in |
| OpenAI Codex CLI | `codex "prompt"` | Requires `npm i -g @openai/codex` |
| Cursor (headless) | `cursor --new-window --goto file:line` | Opens file in Cursor at line |
| Aider | `aider --message "prompt" file1 file2` | Multi-file AI editor |
| Custom | configurable command template | User-defined in `.treewriter.json` |

Stored in `.treewriter.json` at repo root:
```json
{
  "aiProviders": [
    {
      "name": "Claude Code",
      "command": "claude",
      "args": ["-p", "{prompt}"],
      "contextFlag": "--context",
      "supportsFiles": true
    },
    {
      "name": "Codex",
      "command": "codex",
      "args": ["{prompt}"],
      "supportsFiles": false
    },
    {
      "name": "Aider",
      "command": "aider",
      "args": ["--message", "{prompt}", "{files}"],
      "supportsFiles": true
    }
  ]
}
```

## UI: Agent Dispatch Panel

Replaces the right sidebar in TreeWriter frontend (currently just terminal). Panel has two zones:

```
┌─────────────────────────────────────────────────┐
│  AI AGENT DISPATCH                              │
│ ─────────────────────────────────────────────── │
│  Paper:    [ml-study ▼]                         │
│  Section:  [introduction ▼]          [← from Quartz] │
│  Stage:    [drafts ▼]   (outline|draft|final)   │
│                                                 │
│  AI:       [Claude Code ▼]                      │
│  Action:   [Draft section ▼]                    │
│            ├ Draft section                      │
│            ├ Revise based on feedback           │
│            ├ Expand outline                     │
│            ├ Check citations                    │
│            ├ Summarize for abstract             │
│            └ Custom prompt...                   │
│                                                 │
│  Context files (auto-selected):                 │
│  ☑ outlines/introduction.md                    │
│  ☑ notes/literature/hemocytometer-1962.md      │
│  ☑ notes/data/participant-stats.md             │
│  ☐ notes/feedback/overleaf-2026-06-14.md       │
│                                                 │
│  [▶ Run Agent]          [Preview prompt]        │
│ ─────────────────────────────────────────────── │
│  TERMINAL                                       │
│  $ claude -p "You are writing..."               │
│  > Writing introduction section...              │
│  > Saved to drafts/introduction-v3.md           │
└─────────────────────────────────────────────────┘
```

## Context Auto-Population

When Quartz navigates to `papers/ml-study/outlines/introduction.md`, the dispatch panel auto-fills:
- **Paper:** ml-study
- **Section:** introduction
- **Stage:** outline (from frontmatter `status: outline`)

Context files auto-selected by rules:
1. Always include: the current outline file
2. Include all `notes/literature/` files tagged `relevance: [introduction]` in frontmatter
3. Include all `notes/data/` files tagged `sections: [introduction]`
4. Include unresolved `notes/feedback/` items where `section: introduction`

User can deselect any, or add others via file picker.

## Prompt Construction

"Draft section" action constructs:

```
You are writing the {section} section of a {journal} paper titled "{paper_title}".
Target: {target_words} words. Style: {journal} (formal, third person, passive voice).

SECTION GOAL AND KEY CLAIMS:
{outlines/introduction.md content}

AVAILABLE EVIDENCE (cite as [@cite_key]):
{notes/literature/*.md for this section — title, claim, cite_key fields}

STATISTICS AND FIGURES:
{notes/data/*.md for this section — stat, figure_path, caption fields}

UNRESOLVED REVIEWER FEEDBACK (address if present):
{notes/feedback/*.md unresolved, this section}

Write ONLY the section body. Use [@cite_key] format for citations.
End with: "<!-- files written: drafts/{section}-v{N}.md -->"
```

"Revise based on feedback" swaps in the current draft and feedback:

```
You are revising the {section} section. Current draft:

{drafts/section-vN.md}

Reviewer feedback to address:
{notes/feedback unresolved for this section}

Rewrite the section addressing all feedback. At the end list which items you addressed.
```

## New Backend Endpoints

### GET /api/agent/providers
Returns list of configured AI providers from `.treewriter.json`.

### POST /api/agent/dispatch
```typescript
// Body: {
//   provider: "claude" | "codex" | "aider" | string,
//   paperSlug: string,
//   section: string,
//   action: "draft" | "revise" | "expand" | "cite-check" | "custom",
//   contextFiles: string[],   // relative paths in model/
//   customPrompt?: string,
//   options?: { targetWords?: number }
// }
//
// 1. Builds prompt from action template + contextFiles
// 2. Determines output path: drafts/{section}-v{N+1}.md
// 3. Spawns AI command in PTY:
//    claude -p "{prompt}" → agent writes to file via its own tools
//    OR: codex "{prompt}" → capture output → write to file
// 4. Streams terminal output via /model-events
// 5. Returns { jobId, outputPath, terminalSessionId }
```

### GET /api/agent/jobs
Returns recent agent runs: `[{ jobId, provider, section, action, status, outputPath, startedAt }]`

### POST /api/agent/jobs/:id/cancel
Kills PTY process for that job.

## Output Routing

**Claude Code** (has file tools): prompt ends with "Save to drafts/{section}-v{N}.md". Claude Code writes the file itself. Backend watches for the file via `fs.watch` → broadcasts `model-changed`.

**Codex / Aider** (no file tools or different interface): backend captures stdout → writes to `drafts/{section}-v{N}.md` programmatically.

Auto-increment version: scan `drafts/` for existing `{section}-v*.md` → pick `vN+1`.

## "Preview Prompt" Button

Shows the full constructed prompt in a modal before sending. Authors can edit before dispatch. This prevents surprises and lets authors customize without knowing the template.

## Manual Terminal Still Available

The raw terminal (xterm.js) stays available below the dispatch panel. Authors can type arbitrary commands — useful for:

```bash
# Run full analysis + draft in one shot
claude "Read all files in model/papers/ml-study/ and write a complete methods section draft"

# Point Cursor at a specific line
cursor --goto model/papers/ml-study/drafts/introduction-v2.md:42

# Run Aider on multiple files
aider --message "improve flow" drafts/intro-v2.md drafts/methods-v1.md
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+R` | Run agent with current context |
| `Cmd+Shift+P` | Preview prompt |
| `Cmd+Shift+A` | Focus AI provider selector |
| `Cmd+K` | Search (Quartz) |
| `Cmd+E` | Toggle editor focus |
