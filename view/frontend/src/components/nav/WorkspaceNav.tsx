import { cn } from "@/lib/utils";
import { ExplorerNavPanel } from "@/components/nav/ExplorerNavPanel";
import { PapersSidebar } from "@/components/nav/PapersSidebar";
import type { WorkspaceModeTab } from "@/components/layout/WorkspaceModeTabs";
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
  onLoadSubtree,
  onPaperCreated,
  onModelChanged,
  onError,
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
  onLoadSubtree?: (folderPath: string, depth?: number) => Promise<boolean>;
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
          onLoadSubtree={onLoadSubtree}
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
        />
      )}
    </aside>
  );
}
