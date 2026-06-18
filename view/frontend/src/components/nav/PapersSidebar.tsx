import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { PaperAssetsPanel } from "@/components/nav/PaperAssetsPanel";
import { TrashPanel } from "@/components/nav/TrashPanel";
import { GraphPanel } from "@/GraphPanel";
import { PaperInfoLine } from "@/components/nav/PaperInfoLine";
import { PaperSelectorBar } from "@/components/nav/PaperSelectorBar";
import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { PapersPanel } from "@/PapersPanel";
import { cn } from "@/lib/utils";
import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  saveWorkspacePreferences,
  type PapersSidebarPanels,
} from "@/lib/workspacePreferences";
import type { GraphScope } from "@/lib/graphLocal";
import type { ModelNode } from "@/lib/modelTree";

function SidebarSection({
  title,
  open,
  onToggle,
  children,
  className,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <button
        type="button"
        className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent/40"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        {title}
      </button>
      {open ? children : null}
    </div>
  );
}

export function PapersSidebar({
  tree,
  currentPath,
  activeFile,
  refreshVersion,
  onNavigate,
  onOpenFile,
  onPaperCreated,
  onModelChanged,
  onError,
  graphFetchRoot,
  graphFocusPath,
  graphScope,
  onGraphScopeChange,
  onGraphSelectNode,
  embedded = false,
}: {
  tree: ModelNode[];
  currentPath: string;
  activeFile: string | null;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
  graphFetchRoot: string;
  graphFocusPath: string;
  graphScope: GraphScope;
  onGraphScopeChange: (scope: GraphScope) => void;
  onGraphSelectNode: (id: string) => void;
  embedded?: boolean;
}) {
  const [panels, setPanels] = useState<PapersSidebarPanels>(() =>
    mergeWorkspaceDefaults(loadWorkspacePreferences()).papersSidebar,
  );
  const selectedSlug = paperSlugFromPath(currentPath);
  const paperPath = selectedSlug ? `papers/${selectedSlug}` : null;

  useEffect(() => {
    saveWorkspacePreferences({ papersSidebar: panels });
  }, [panels]);

  const togglePanel = useCallback((key: keyof PapersSidebarPanels) => {
    setPanels((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const { sectionsOpen, assetsOpen, removedOpen, graphOpen } = panels;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        embedded ? "min-h-0 flex-1 overflow-hidden" : "border-r border-border bg-sidebar",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="space-y-2 border-b border-border p-3">
          <PaperSelectorBar
            tree={tree}
            currentPath={currentPath}
            refreshVersion={refreshVersion}
            onNavigate={onNavigate}
            onPaperCreated={onPaperCreated}
            onError={onError}
          />
          <PaperInfoLine
            slug={selectedSlug}
            refreshVersion={refreshVersion}
            onError={onError}
          />
        </div>

        <SidebarSection
          title="Sections"
          open={sectionsOpen}
          onToggle={() => togglePanel("sectionsOpen")}
        >
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
        </SidebarSection>

        <SidebarSection
          title="Assets"
          open={assetsOpen}
          onToggle={() => togglePanel("assetsOpen")}
        >
          <PaperAssetsPanel
            paperPath={paperPath}
            currentPath={currentPath}
            activeFile={activeFile}
            refreshVersion={refreshVersion}
            onNavigate={onNavigate}
            onOpenFile={onOpenFile}
            onModelChanged={onModelChanged}
            onError={onError}
          />
        </SidebarSection>

        <SidebarSection
          title="Removed"
          open={removedOpen}
          onToggle={() => togglePanel("removedOpen")}
        >
          <TrashPanel
            paperPath={paperPath}
            refreshVersion={refreshVersion}
            onModelChanged={onModelChanged}
            onNavigate={onNavigate}
            onError={onError}
          />
        </SidebarSection>

        <SidebarSection
          title="Graph"
          open={graphOpen}
          onToggle={() => togglePanel("graphOpen")}
        >
          <div className="graph-tab-host flex h-[min(240px,36vh)] min-h-[200px] shrink-0 flex-col overflow-hidden">
            <GraphPanel
              embedded
              active={graphOpen}
              fetchRoot={graphFetchRoot}
              focusPath={graphFocusPath}
              graphScope={graphScope}
              refreshVersion={refreshVersion}
              onGraphScopeChange={onGraphScopeChange}
              onSelectNode={onGraphSelectNode}
            />
          </div>
        </SidebarSection>
      </div>
    </div>
  );
}
