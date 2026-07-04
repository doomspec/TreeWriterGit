import { subtreeRootForChange } from "@/lib/model/modelTreeMerge";
import { PAPERS_ROOT } from "@/lib/modelTree";
import type { ReloadModelScope } from "@/lib/useModelTree";

/**
 * Chooses which subtree to reload after a model change.
 *
 * Precedence: `activeFile` subtree → `browsePath` (if not papers root) → `paperPath`.
 */
export function resolveModelReloadScope(options: {
  browsePath?: string | null;
  paperPath?: string | null;
  activeFile?: string | null;
}): ReloadModelScope | undefined {
  const fromFile = options.activeFile ? subtreeRootForChange(options.activeFile) : "";
  if (fromFile) return { path: fromFile };

  const browse = options.browsePath?.replace(/\\/g, "/") ?? "";
  if (browse && browse !== PAPERS_ROOT) return { path: browse };

  const paper = options.paperPath?.replace(/\\/g, "/") ?? "";
  if (paper) return { path: paper };

  return undefined;
}
