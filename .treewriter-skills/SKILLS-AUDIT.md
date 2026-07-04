# Dispatch skills audit — second pass (2026-07-04)

Applied [writing-great-skills](_meta/writing-great-skills/SKILL.md) after **system/user split** and **dispatch action migration**.

## Layout (current)

| Tier | Path | Loaded |
|------|------|--------|
| System rules | `system/treewriter-*.md` (2) | Always on every preview |
| System actions | `system/dispatch-*.md` (14) | Per matching action only |
| User rules | `user/*.md` | If in `dispatchSkillsEnabled` |
| Reference (user) | `user/*-reference.md` | Only if explicitly enabled |

## Refactor changes (this pass)

| Action | Files | Notes |
|--------|-------|-------|
| **Split** technology-paper detail | `technology-paper-reference.md` | Main skill ~40% smaller; 8-point + Cellpose baseline in reference |
| **System/user paths** | All skills under `system/` or `user/` | Config lists user basenames only |
| **Dispatch prompts** | 14 × `system/dispatch-{action}.md` | Editable + reset; excluded from global append |
| **CLI sync** | `treewriter-context-cli.md` | Assistant panel, context/graph/sessions/health commands |
| **Approval paths** | `treewriter-structure-and-assets.md` | `.approval/draft.approved.md` |

## Leading words

| Skill | Leading word |
|-------|--------------|
| treewriter-context-cli | layers |
| treewriter-structure-and-assets | markup |
| writing-deslop-basics | deslop |
| scientific-writing-framework | hourglass |
| technology-paper | technology |
| dispatch-{action} | action name + outputPath |

## Dedup map (single source of truth)

| Topic | Authoritative |
|-------|---------------|
| Folder layout, INDEX/outline/draft | structure-and-assets |
| tw-context / import / Zotero CLI | context-cli |
| Pandoc markup, embeds | structure-and-assets |
| Voice / AI tells | writing-deslop-basics |
| Story arc / hourglass | scientific-writing-framework |
| Methods-paper framing (detail) | technology-paper-reference |
| Per-action task prose | system/dispatch-{action}.md |
| Dispatch catalog (human docs) | docs/ai-and-agents.md |

## Token budget (rough)

- System rules: ~2 × treewriter skills ≈ 8–10 KB
- One action template per preview: ~0.5–2 KB each (not all 14 at once)
- Enabled user skills: author-controlled (3 shipped defaults ≈ 15 KB if all on)

Target: no duplicated CLI blocks between context-cli and structure-and-assets; action templates contain task prose only (no cross-cutting rules).

## First pass (2026-07-04, pre-split)

Merged cellpose into technology-paper; split scientific-writing reference; pruned backend CLI duplicate in contextPrefetch. See git history for byte estimates (~28 KB active rules before system/action split).
