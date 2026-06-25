import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { SearchResults } from "@/components/layout/SearchResults";
import { PaperAssetsPanel } from "@/components/nav/PaperAssetsPanel";
import { TrashPanel } from "@/components/nav/TrashPanel";
import { PaperInfoLine } from "@/components/nav/PaperInfoLine";
import { PaperSelectorBar } from "@/components/nav/PaperSelectorBar";
import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { PapersPanel } from "@/components/paper/PapersPanel";
import { cn } from "@/lib/utils";
import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  saveWorkspacePreferences,
  type PapersSidebarPanels,
} from "@/lib/workspacePreferences";
import type { ModelNode } from "@/lib/modelTree";
import { PAPERS_ROOT } from "@/lib/modelTree";
import type { SearchHit } from "@/modelApi";

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
  searchQuery = "",
  onSearchChange,
  onSearchSelect,
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
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSelect?: (hit: SearchHit) => void;
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

  const { sectionsOpen, assetsOpen, removedOpen } = panels;

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
            onModelChanged={onModelChanged}
            onError={onError}
          />
          <PaperInfoLine
            slug={selectedSlug}
            refreshVersion={refreshVersion}
            onError={onError}
          />
          {onSearchChange ? (
            <div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder={paperPath ? "Search this paper…" : "Search papers…"}
                  value={searchQuery}
                  className="ui-input pl-8"
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
              {onSearchSelect ? (
                <SearchResults
                  query={searchQuery}
                  root={paperPath ?? PAPERS_ROOT}
                  onSelect={onSearchSelect}
                  className="mt-2 rounded-md border-t-0"
                />
              ) : null}
            </div>
          ) : null}
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
      </div>
    </div>
  );
}
