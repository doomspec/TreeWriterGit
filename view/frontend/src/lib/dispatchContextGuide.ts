/** Paper root path (papers/{slug}) from any model path. */
export function paperRootFromPath(modelPath: string): string {
  const normalized = modelPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const match = normalized.match(/^(papers\/[^/]+)/);
  return match?.[1] ?? "";
}

/** Example tw-context commands scoped to the current unit (terminal cwd = model/). */
export function buildContextCliExamples(unitPath?: string): string[] {
  const paper = paperRootFromPath(unitPath ?? "") || "papers/{slug}";
  const unit = unitPath?.trim() || `${paper}/section/unit`;
  return [
    `node ../scripts/tw-context.mjs search "keywords" --root ${paper}`,
    `node ../scripts/tw-context.mjs read ${unit}/draft.md`,
    `node ../scripts/tw-context.mjs tree ${paper} --depth 1`,
    `node ../scripts/tw-context.mjs compose ${paper}/sections/{section}`,
    `node ../scripts/tw-context.mjs context ${unit} --action draft`,
    `node ../scripts/tw-context.mjs graph ${unit}`,
    `node ../scripts/tw-context.mjs sessions ${paper} --kind chat`,
    `node ../scripts/tw-context.mjs health`,
    `pnpm import-docx ${paper} /path/to/file.docx   # repo root only`,
  ];
}

export function buildContextCliQuickRef(unitPath?: string): string {
  const examples = buildContextCliExamples(unitPath);
  return [
    "TreeWriter AI usage (terminal cwd = model/ for file paths; run import scripts from repo root):",
    "",
    ...examples.map((line) => `  ${line}`),
    "",
    "Search, compose, context, graph, and health need pnpm dev. read, tree, and sessions work offline.",
    "System skills: .treewriter-skills/system/treewriter-context-cli.md (always loaded on dispatch).",
  ].join("\n");
}

export const DISPATCH_CONTEXT_LAYERS_SUMMARY =
  "Every preview adds linked files, sibling unit outlines, and related search hits in the same paper. Check extra files in the Assistant panel context list to override; use tw-context in the terminal for more.";
