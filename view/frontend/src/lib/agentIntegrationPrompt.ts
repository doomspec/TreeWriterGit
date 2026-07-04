import {
  buildContextCliQuickRef,
  DISPATCH_CONTEXT_LAYERS_SUMMARY,
  paperRootFromPath,
} from "@/lib/dispatchContextGuide";

/** Copyable system prompt for external AI assistants working with TreeWriter. */
export function buildAgentIntegrationPrompt(unitPath?: string): string {
  const pathLine = unitPath?.trim()
    ? `Current unit path: \`${unitPath.trim()}\``
    : "Ask the author which unit folder to work in (e.g. `papers/my-paper/introduction/problem`).";

  const paper = paperRootFromPath(unitPath ?? "");
  const paperLine = paper
    ? `Paper scope: \`${paper}\` — scope search and reads to this tree when exploring.`
    : "";

  return `You are assisting with a TreeWriter scientific manuscript project.

TreeWriter stores papers as a folder tree of markdown units. Each unit has:
- \`outline.md\` — section intent and bullet outline
- \`draft.md\` — manuscript paragraph (live working copy)
- \`.approval/draft.approved.md\` — last approved version for export

${pathLine}
${paperLine}

Rules when drafting or revising:
1. Read \`outline.md\` first to understand what the paragraph must convey.
2. Write or revise \`draft.md\` only — use formal academic language suitable for publication.
3. Do not add preamble, meta-commentary, or markdown headings unless the outline requires them.
4. Preserve citation keys, figure/table/equation embeds, and wikilinks exactly as written.
5. Edits autosave for collaborators; the author must click **Approve** before export.
6. Keep one focused paragraph per unit unless the outline explicitly calls for more.

When TreeWriter runs AI dispatch, the prompt already includes outline, draft, links, literature, sibling units, and paper-scoped search hits. Fetch more only if needed:

${buildContextCliQuickRef(unitPath)}

Skills: \`.treewriter-skills/system/\` (TreeWriter runtime + action prompts, always loaded) and \`.treewriter-skills/user/\` (optional writing rules, toggled in Settings → Skills). Action prompts are editable with Reset to repo default.

After dispatch finishes in the integrated terminal, session traces land under \`papers/{slug}/notes/sessions/\` (chat) or \`{unit}/.sessions/\` (dispatch).`;
}

export function buildDispatchGuideText(): string {
  return `TreeWriter AI dispatch — three layers of context (no project MCP)

${DISPATCH_CONTEXT_LAYERS_SUMMARY}

Layer 1 — Prompt assembly (every preview)
  Unit outline + draft, INDEX links, cited literature/assets.
  Optional: check files under "Unit context" in the Assistant panel.

Layer 2 — Auto prefetch (default, no checklist)
  Sibling unit outlines + FTS search hits in the same paper.

Layer 3 — On demand (agent runs in terminal)
  node ../scripts/tw-context.mjs search|read|tree|compose|context|graph|sessions|health  (cwd = model/)
  pnpm import-docx / import-references  (repo root, bulk import)
  pnpm tw-zotero search|import|snippet  (when Settings → Extensions → Zotero enabled)
  Documented in .treewriter-skills/system/treewriter-context-cli.md

Workflow:
1. Open a unit (or section for fan-out).
2. Assistant panel (sparkle icon, right split) → chat hot commands or dispatch actions → Preview or Run.
3. Prompt writes to model/.treewriter-prompts/<session>.txt; terminal cwd = model/.
4. Edit only the output path named in the prompt; author approves for export.

Skills:
  system/ — treewriter-context-cli + structure-and-assets (always) + dispatch-{action}.md (per action)
  user/ — optional writing rules; enable in Settings → Skills (.treewriter.json dispatchSkillsEnabled)

Providers: .treewriter.json at repo root (aiProviders, defaultProvider).
Keep pnpm dev running for FTS search, section compose, and API-backed tw-context commands.`;
}
