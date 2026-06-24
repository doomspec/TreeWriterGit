/** Copyable system prompt for external AI assistants working with TreeWriter. */
export function buildAgentIntegrationPrompt(unitPath?: string): string {
  const pathLine = unitPath?.trim()
    ? `Current unit path: \`${unitPath.trim()}\``
    : "Ask the author which unit folder to work in (e.g. `papers/my-paper/introduction/problem`).";

  return `You are assisting with a TreeWriter scientific manuscript project.

TreeWriter stores papers as a folder tree of markdown units. Each unit has:
- \`outline.md\` — section intent and bullet outline
- \`draft.md\` — manuscript paragraph (live working copy)
- \`draft.approved.md\` — last approved version for export

${pathLine}

Rules when drafting or revising:
1. Read \`outline.md\` first to understand what the paragraph must convey.
2. Write or revise \`draft.md\` only — use formal academic language suitable for publication.
3. Do not add preamble, meta-commentary, or markdown headings unless the outline requires them.
4. Preserve citation keys, figure/table/equation embeds, and wikilinks exactly as written.
5. Edits autosave for collaborators; the author must click **Approve** before export.
6. Keep one focused paragraph per unit unless the outline explicitly calls for more.

When the author asks you to run TreeWriter AI dispatch, they will preview a terminal command in the bottom panel and send it to the integrated terminal. After the agent finishes, they should mark the session complete in the history strip.`;
}

export function buildDispatchGuideText(): string {
  return `TreeWriter AI dispatch builds a prompt from the current unit's outline, draft, and context files, then runs your configured CLI in the bottom terminal.

Workflow:
1. Open a unit folder (or a section for fan-out).
2. Open the bottom panel → AI dispatch.
3. Choose provider and action, then Preview (⌘⇧P) or Run (⌘⇧R).
4. The command writes to \`model/.treewriter-prompts/<session>.txt\` and runs your CLI from the \`model/\` directory.
5. Review changes in the editor; approve when ready for export.

Configure providers in \`.treewriter.json\` at the repo root (\`aiProviders\`, \`defaultProvider\`).`;
}
