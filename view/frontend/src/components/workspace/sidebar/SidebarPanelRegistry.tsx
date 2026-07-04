import { lazy, Suspense, type ReactNode } from "react";

import { ApprovalReviewPanel } from "@/components/nav/ApprovalReviewPanel";
import { AssetsPanel } from "@/components/nav/PaperAssetsPanel";
import { PaperInfoPanel } from "@/components/nav/PaperInfoPanel";
import { ReferencesPanel } from "@/components/nav/ReferencesPanel";
import { RemovedPanel } from "@/components/nav/RemovedPanel";
import { WorkspaceNav } from "@/components/nav/WorkspaceNav";
import { PaperExportPanel } from "@/components/paper/PaperExportPanel";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { SidebarPanel } from "@/lib/workspacePreferences";
import type { GraphScope } from "@/lib/graphLocal";
import type { ModelNode } from "@/lib/modelTreeTypes";

const GraphPanel = lazy(() =>
  import("@/components/graph/GraphPanel").then((m) => ({ default: m.GraphPanel })),
);

export type SidebarPanelRegistryProps = {
  panel: SidebarPanel;
  tree: ModelNode[];
  browsePath: string;
  activeFile: string | null;
  refreshVersion: number;
  graphFetchRoot: string | null;
  graphFocusPath: string | null;
  graphScope: GraphScope;
  exportPaperSlug: string | null;
  paperPath: string | null;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onGraphScopeChange: (scope: GraphScope) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
};

/** Renders sidebar panel content for the active panel id. */
export function SidebarPanelRegistry({
  panel,
  tree,
  browsePath,
  activeFile,
  refreshVersion,
  graphFetchRoot,
  graphFocusPath,
  graphScope,
  exportPaperSlug,
  paperPath,
  onNavigate,
  onOpenFile,
  onGraphScopeChange,
  onPaperCreated,
  onModelChanged,
  onError,
}: SidebarPanelRegistryProps): ReactNode {
  if (panel === "review") {
    return <ApprovalReviewPanel className="h-full" />;
  }

  if (panel === "paperInfo") {
    return (
      <PaperInfoPanel
        className="h-full"
        tree={tree}
        currentPath={browsePath}
        refreshVersion={refreshVersion}
        onNavigate={onNavigate}
        onPaperCreated={onPaperCreated}
        onModelChanged={onModelChanged}
        onError={onError}
      />
    );
  }

  if (panel === "references") {
    return (
      <ReferencesPanel
        paperPath={paperPath}
        activeFile={activeFile}
        refreshVersion={refreshVersion}
        onOpenFile={onOpenFile}
        onModelChanged={onModelChanged}
        onError={onError}
      />
    );
  }

  if (panel === "assets") {
    return (
      <AssetsPanel
        className="h-full"
        paperPath={paperPath}
        currentPath={browsePath}
        activeFile={activeFile}
        refreshVersion={refreshVersion}
        onNavigate={onNavigate}
        onOpenFile={onOpenFile}
        onModelChanged={onModelChanged}
        onError={onError}
      />
    );
  }

  if (panel === "removed") {
    return (
      <RemovedPanel
        className="h-full"
        paperPath={paperPath}
        refreshVersion={refreshVersion}
        onNavigate={onNavigate}
        onModelChanged={onModelChanged}
        onError={onError}
      />
    );
  }

  if (panel === "graph") {
    return (
      <div className="graph-tab-host flex h-full min-h-[200px] flex-col overflow-hidden">
        <Suspense fallback={<LoadingSkeleton className="p-3" lines={4} />}>
          <GraphPanel
            embedded
            active
            fetchRoot={graphFetchRoot ?? ""}
            focusPath={graphFocusPath ?? ""}
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

  return (
    <WorkspaceNav
      tree={tree}
      currentPath={browsePath}
      refreshVersion={refreshVersion}
      onNavigate={onNavigate}
      onPaperCreated={onPaperCreated}
      onModelChanged={onModelChanged}
      onError={onError}
    />
  );
}
