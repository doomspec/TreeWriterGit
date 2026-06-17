import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { GraphPanel } from "@/GraphPanel";
import { PaperInfoLine } from "@/components/nav/PaperInfoLine";
import { PaperSelectorBar } from "@/components/nav/PaperSelectorBar";
import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { PapersPanel } from "@/PapersPanel";
import { SearchResults } from "@/components/layout/SearchResults";
import { cn } from "@/lib/utils";
import { PAPERS_ROOT } from "@/lib/modelTree";
import type { GraphScope } from "@/lib/graphLocal";
import type { SearchHit } from "@/modelApi";
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
  refreshVersion,
  searchQuery,
  onSearchChange,
  onSearchSelect,
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
  graphFetchRoot,
  graphFocusPath,
  graphScope,
  onGraphScopeChange,
  onGraphSelectNode,
  paperSearchRoot,
  embedded = false,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSelect?: (hit: SearchHit) => void;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
  graphFetchRoot: string;
  graphFocusPath: string;
  graphScope: GraphScope;
  onGraphScopeChange: (scope: GraphScope) => void;
  onGraphSelectNode: (id: string) => void;
  paperSearchRoot?: string;
  embedded?: boolean;
}) {
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const selectedSlug = paperSlugFromPath(currentPath);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        embedded ? "min-h-0 flex-1" : "border-r border-border bg-sidebar",
      )}
    >
      <div className="shrink-0 space-y-2 border-b border-border p-3">
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
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search papers…"
            value={searchQuery}
            className="ui-input pl-8"
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {onSearchSelect ? (
          <SearchResults
            query={searchQuery}
            root={paperSearchRoot ?? PAPERS_ROOT}
            onSelect={onSearchSelect}
          />
        ) : null}
      </div>

      <SidebarSection
        title="Sections"
        open={sectionsOpen}
        onToggle={() => setSectionsOpen((open) => !open)}
        className={cn(
          sectionsOpen && graphOpen && "max-h-[min(50%,22rem)] shrink-0",
          sectionsOpen && !graphOpen && "min-h-0 flex-1",
        )}
      >
        <div className="min-h-0 overflow-auto">
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
      </SidebarSection>

      <SidebarSection
        title="Graph"
        open={graphOpen}
        onToggle={() => setGraphOpen((open) => !open)}
        className={graphOpen ? "min-h-0 flex-1" : undefined}
      >
        <div className="graph-tab-host flex min-h-0 flex-1 flex-col overflow-hidden">
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
  );
}
