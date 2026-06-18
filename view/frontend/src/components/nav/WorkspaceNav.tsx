import { cn } from "@/lib/utils";
import { ExplorerNavPanel } from "@/components/nav/ExplorerNavPanel";
import { PapersSidebar } from "@/components/nav/PapersSidebar";
import type { WorkspaceModeTab } from "@/components/layout/WorkspaceModeTabs";
import type { GraphScope } from "@/lib/graphLocal";
import type { SearchHit } from "@/modelApi";
import type { ModelNode } from "@/lib/modelTree";

export type WorkspaceNavTab = WorkspaceModeTab;

export function WorkspaceNav({
  tree,
  currentPath,
  activeFile,
  activeTab,
  searchQuery,
  refreshVersion,
  onSearchChange,
  onNavigate,
  onOpenFile,
  onSearchSelect,
  onPaperCreated,
  onModelChanged,
  onError,
  graphFetchRoot,
  graphFocusPath,
  graphScope,
  onGraphScopeChange,
  onGraphSelectNode,
  paperSearchRoot,
}: {
  tree: ModelNode[];
  currentPath: string;
  activeFile: string | null;
  activeTab: WorkspaceNavTab;
  searchQuery: string;
  refreshVersion: number;
  onSearchChange: (query: string) => void;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onSearchSelect?: (hit: SearchHit) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
  graphFetchRoot: string;
  graphFocusPath: string;
  graphScope: GraphScope;
  onGraphScopeChange: (scope: GraphScope) => void;
  onGraphSelectNode: (id: string) => void;
  paperSearchRoot?: string;
}) {
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar">
      {activeTab === "explorer" ? (
        <ExplorerNavPanel
          embedded
          tree={tree}
          currentPath={currentPath}
          activeFile={activeFile}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSearchSelect={onSearchSelect}
          onNavigate={onNavigate}
          onOpenFile={onOpenFile}
        />
      ) : (
        <PapersSidebar
          embedded
          tree={tree}
          currentPath={currentPath}
          activeFile={activeFile}
          refreshVersion={refreshVersion}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSearchSelect={onSearchSelect}
          onNavigate={onNavigate}
          onOpenFile={onOpenFile}
          onPaperCreated={onPaperCreated}
          onModelChanged={onModelChanged}
          onError={onError}
          graphFetchRoot={graphFetchRoot}
          graphFocusPath={graphFocusPath}
          graphScope={graphScope}
          onGraphScopeChange={onGraphScopeChange}
          onGraphSelectNode={onGraphSelectNode}
          paperSearchRoot={paperSearchRoot}
        />
      )}
    </aside>
  );
}
