import { lazy, Suspense, type ReactNode } from "react";

import { ApprovalReviewPanel } from "@/components/nav/ApprovalReviewPanel";
import { DocumentOutlinePanel } from "@/components/nav/DocumentOutlinePanel";
import { WorkspaceNav } from "@/components/nav/WorkspaceNav";
import { DocxImportPanel } from "@/components/paper/DocxImportPanel";
import { PaperExportPanel } from "@/components/paper/PaperExportPanel";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { SidebarPanel } from "@/lib/workspacePreferences";
import type { GraphScope } from "@/lib/graphLocal";
import type { ModelNode } from "@/lib/modelTreeTypes";
import type { WorkspaceNavTab } from "@/components/nav/WorkspaceNav";

const GraphPanel = lazy(() =>
  import("@/components/graph/GraphPanel").then((m) => ({ default: m.GraphPanel })),
);

export type SidebarPanelRegistryProps = {
  panel: SidebarPanel;
  tree: ModelNode[];
  browsePath: string;
  activeFile: string | null;
  searchQuery: string;
  refreshVersion: number;
  graphFetchRoot: string | null;
  graphFocusPath: string | null;
  graphScope: GraphScope;
  exportPaperSlug: string | null;
  paperPath: string | null;
  onSearchChange: (query: string) => void;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onSearchSelect: (path: string) => void;
  onLoadSubtree: (path: string) => void;
  onGraphScopeChange: (scope: GraphScope) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
  onSidebarTabChange: (tab: WorkspaceNavTab) => void;
};

/** Renders sidebar panel content for the active panel id. */
export function SidebarPanelRegistry({
  panel,
  tree,
  browsePath,
  activeFile,
  searchQuery,
  refreshVersion,
  graphFetchRoot,
  graphFocusPath,
  graphScope,
  exportPaperSlug,
  paperPath,
  onSearchChange,
  onNavigate,
  onOpenFile,
  onSearchSelect,
  onLoadSubtree,
  onGraphScopeChange,
  onPaperCreated,
  onModelChanged,
  onError,
  onSidebarTabChange,
}: SidebarPanelRegistryProps): ReactNode {
  if (panel === "outline") {
    return <DocumentOutlinePanel className="h-full" />;
  }

  if (panel === "review") {
    return <ApprovalReviewPanel className="h-full" />;
  }

  if (panel === "graph") {
    return (
      <div className="graph-tab-host flex h-full min-h-[200px] flex-col overflow-hidden">
        <Suspense fallback={<LoadingSkeleton className="p-3" lines={4} />}>
          <GraphPanel
            embedded
            active
            fetchRoot={graphFetchRoot ?? ""}
            focusPath={graphFocusPath}
            graphScope={graphScope}
            refreshVersion={refreshVersion}
            onGraphScopeChange={onGraphScopeChange}
            onSelectNode={(id) => {
              if (id.startsWith("missing:")) return;
              onNavigate(id);
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (panel === "export") {
    return (
      <PaperExportPanel
        className="h-full"
        paperSlug={exportPaperSlug}
        onError={onError}
        onComplete={onModelChanged}
      />
    );
  }

  if (panel === "import") {
    return (
      <DocxImportPanel
        className="h-full"
        paperSlug={exportPaperSlug}
        paperPath={paperPath}
        browsePath={browsePath}
        activeFile={activeFile}
        onError={onError}
        onComplete={onModelChanged}
      />
    );
  }

  return (
    <WorkspaceNav
      tree={tree}
      currentPath={browsePath}
      activeFile={activeFile}
      activeTab={panel === "papers" ? "papers" : "explorer"}
      searchQuery={searchQuery}
      refreshVersion={refreshVersion}
      onSearchChange={onSearchChange}
      onNavigate={onNavigate}
      onOpenFile={onOpenFile}
      onSearchSelect={onSearchSelect}
      onLoadSubtree={onLoadSubtree}
      onPaperCreated={(path) => {
        onPaperCreated(path);
        onSidebarTabChange("papers");
      }}
      onModelChanged={onModelChanged}
      onError={onError}
    />
  );
}
