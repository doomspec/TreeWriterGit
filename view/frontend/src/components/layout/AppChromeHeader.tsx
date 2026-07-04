import { ArrowLeft } from "lucide-react";

import { paperSlugFromPath } from "@/components/nav/PaperSelect";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TreeWriterBrand } from "@/components/layout/TreeWriterBrand";
import { WorkspaceChromeActions } from "@/components/layout/WorkspaceChromeActions";
import { PaperSearchField } from "@/components/paper/PaperSearchField";
import { Button } from "@/components/ui/button";
import type { ModelNode } from "@/lib/modelTree";
import { useReadingFocus } from "@/lib/readingFocus";
import type { SearchHit } from "@/modelApi";
import { cn } from "@/lib/utils";

export function AppChromeHeader({
  appView,
  browsePath,
  onNavigate,
  breadcrumbVariant = "default",
  tree,
  refreshVersion = 0,
  onOpenFile,
  paperPath = null,
  searchQuery = "",
  onSearchChange,
  onSearchSelect,
  onRefreshModel,
  onHomeClick,
  canBack = false,
  onBack,
  backTitle = "Back",
  homeTitle = "Home",
  explorerMode = false,
  aiPanelOpen = false,
  onToggleAiPanel,
  onOpenTerminal,
  onOpenHistory,
  onOpenSkills,
}: {
  appView: "workspace" | "settings" | "info";
  browsePath: string;
  onNavigate: (path: string) => void;
  breadcrumbVariant?: "default" | "papers";
  tree?: ModelNode[];
  refreshVersion?: number;
  onOpenFile?: (path: string) => void;
  paperPath?: string | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSelect?: (hit: SearchHit) => void;
  onRefreshModel: () => void;
  onHomeClick?: () => void;
  canBack?: boolean;
  onBack?: () => void;
  backTitle?: string;
  homeTitle?: string;
  explorerMode?: boolean;
  aiPanelOpen?: boolean;
  onToggleAiPanel?: () => void;
  onOpenTerminal?: () => void;
  onOpenHistory?: () => void;
  onOpenSkills?: () => void;
}) {
  const { active: readingFocusActive, extraChrome } = useReadingFocus();
  const alignBrandWithSidebar = appView === "workspace" && !explorerMode;

  return (
    <header
      className={cn(
        "app-chrome-header flex h-11 min-w-0 items-center gap-2 border-b border-border bg-card shadow-sm sm:gap-3",
        alignBrandWithSidebar ? "app-chrome-header--sidebar-aligned pr-2 sm:pr-4" : "px-2 sm:px-4",
        readingFocusActive ? "fixed top-0 left-0 right-0 z-[60]" : "relative z-[60] shrink-0",
      )}
    >
      {alignBrandWithSidebar ? (
        <div className="app-chrome-header__brand flex shrink-0 items-center gap-0.5">
          <div className="app-chrome-header__brand-rail">
            <TreeWriterBrand
              explorerMode={explorerMode}
              onHomeClick={onHomeClick}
              homeTitle={homeTitle}
              railAligned
            />
          </div>
          {onHomeClick ? (
            <button
              type="button"
              onClick={onHomeClick}
              className="shrink-0 rounded-md px-0.5 text-sm font-semibold tracking-tight text-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={homeTitle}
              aria-label={homeTitle}
            >
              TreeWriter
            </button>
          ) : (
            <span className="shrink-0 px-0.5 text-sm font-semibold tracking-tight text-foreground">TreeWriter</span>
          )}
        </div>
      ) : null}
      <div className="app-chrome-header__lead flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden sm:gap-3">
        {!alignBrandWithSidebar ? (
          <TreeWriterBrand explorerMode={explorerMode} onHomeClick={onHomeClick} homeTitle={homeTitle} />
        ) : null}
        {appView === "workspace" && !explorerMode ? (
          <>
            <div className="hidden h-4 w-px shrink-0 bg-border md:block" aria-hidden="true" />
            {canBack && onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title={backTitle}
                aria-label={backTitle}
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
            {extraChrome ? (
              <div
                className={cn(
                  "editor-pane-toggle-host flex shrink-0 items-center",
                  aiPanelOpen && "hidden min-[1100px]:flex",
                )}
              >
                {extraChrome}
              </div>
            ) : null}
            <div className="hidden min-w-0 shrink md:block">
              <Breadcrumbs
                path={browsePath}
                onNavigate={onNavigate}
                variant={breadcrumbVariant}
                tree={tree}
                refreshVersion={refreshVersion}
                onOpenFile={onOpenFile}
              />
            </div>
            {paperPath && onSearchChange && onSearchSelect ? (
              <PaperSearchField
                className={cn(
                  "min-w-0 flex-1",
                  aiPanelOpen ? "hidden min-[960px]:block" : "min-w-[8rem] max-w-md",
                )}
                paperPath={paperPath}
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                onSearchSelect={onSearchSelect}
              />
            ) : null}
          </>
        ) : appView !== "workspace" ? (
          <>
            <div className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
            <span className="truncate text-sm font-medium text-foreground">
              {appView === "settings" ? "Settings" : "Guide"}
            </span>
          </>
        ) : null}
      </div>

      {appView === "workspace" ? (
        <div className="app-chrome-header__actions ml-auto flex shrink-0 items-center">
          <WorkspaceChromeActions
            onRefreshModel={onRefreshModel}
            aiPanelOpen={aiPanelOpen}
            onToggleAiPanel={onToggleAiPanel}
            onOpenTerminal={onOpenTerminal}
            onOpenHistory={onOpenHistory}
            onOpenSkills={onOpenSkills}
          />
        </div>
      ) : null}
    </header>
  );
}
