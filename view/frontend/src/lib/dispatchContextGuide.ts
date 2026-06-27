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
    "Search/compose need pnpm dev. read/tree work offline.",
    "Full guide: .treewriter-skills/treewriter-context-cli.md",
  ].join("\n");
}

export const DISPATCH_CONTEXT_LAYERS_SUMMARY =
  "Every preview adds linked files, sibling unit outlines, and related search hits in the same paper. Check extra files below to override; use the terminal CLI for more.";
