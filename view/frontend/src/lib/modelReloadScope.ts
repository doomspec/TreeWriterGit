import { subtreeRootForChange } from "@/lib/model/modelTreeMerge";
import { PAPERS_ROOT } from "@/lib/modelTree";
import type { ReloadModelScope } from "@/lib/useModelTree";

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
