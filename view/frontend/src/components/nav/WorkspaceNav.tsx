import { PapersPanel } from "@/components/paper/PapersPanel";
import type { ModelNode } from "@/lib/modelTree";

/** Section tree for the active manuscript (sidebar "Sections" panel). */
export function WorkspaceNav({
  tree,
  currentPath,
  refreshVersion,
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
}) {
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <PapersPanel
          embedded
          hidePaperHeader
          tree={tree}
          currentPath={currentPath}
          refreshVersion={refreshVersion}
          onNavigate={onNavigate}
          onModelChanged={onModelChanged}
          onPaperCreated={onPaperCreated}
          onError={onError}
        />
      </div>
    </aside>
  );
}
