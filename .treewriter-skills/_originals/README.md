# Original writing skills (archived — not active)

Pre-optimization copies of the writing dispatch-skills, kept as backup.
The dispatch loader scans `.treewriter-skills/` non-recursively and only reads
`*.md` at the top level, so files in this subfolder are **never** loaded into
a dispatch prompt.

The optimized, active versions live one level up in `.treewriter-skills/`.

| Original (here) | Active/optimized (parent dir) |
|-----------------|-------------------------------|
| `scientific-writing-framework-skill.md` (432L) | `scientific-writing-framework-skill.md` (171L) — merged both frameworks |
| `skill-scientific-writing.md` (479L) | *(folded into the merged framework above; no standalone active copy)* |
| `technology-paper-skill.md` (79L) | `technology-paper-skill.md` — tightened description only |
| `writing-deslop-basics.md` (117L) | `writing-deslop-basics.md` — tightened description only |
| `treewriter-context-cli.md` (152L) | `treewriter-context-cli.md` (69L) — deduped vs structure-and-assets, runtime/CLI only |
| `treewriter-structure-and-assets.md` (212L) | `treewriter-structure-and-assets.md` (89L) — deduped, layout/markup/export only |

To revert any skill: copy the original back over its active counterpart and,
for `skill-scientific-writing.md`, re-add it to `dispatchSkillsEnabled` in
`.treewriter.json`.
