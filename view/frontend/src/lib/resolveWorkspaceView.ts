/**
 * Pure workspace route resolver — priority order must match {@link WorkspaceRouter}.
 *
 * 1. paperWorkspacePath — paper root with optional paper-level outline/draft
 * 2. tablePath — table builder folder
 * 3. sectionPath — section container (composed draft, approve-children)
 * 4. editor — unit/figure/equation folder or any activeFile (incl. loose .md)
 * 5. browse — folder listing
 */
export type WorkspaceView =
  | { kind: "paper"; path: string }
  | { kind: "table"; path: string }
  | { kind: "section"; path: string }
  | { kind: "editor"; unitPath: string | null; activeFile: string | null }
  | { kind: "browse" };

export function resolveWorkspaceView(input: {
  paperWorkspacePath: string | null;
  tablePath: string | null;
  sectionPath: string | null;
  unitPath: string | null;
  activeFile: string | null;
}): WorkspaceView {
  if (input.paperWorkspacePath) {
    return { kind: "paper", path: input.paperWorkspacePath };
  }
  if (input.tablePath) {
    return { kind: "table", path: input.tablePath };
  }
  if (input.sectionPath) {
    return { kind: "section", path: input.sectionPath };
  }
  if (input.unitPath || input.activeFile) {
    return {
      kind: "editor",
      unitPath: input.unitPath,
      activeFile: input.activeFile,
    };
  }
  return { kind: "browse" };
}
