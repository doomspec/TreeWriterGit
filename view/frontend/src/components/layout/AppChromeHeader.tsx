import { ArrowLeft } from "lucide-react";

import { paperSlugFromPath } from "@/components/nav/PaperSelect";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TreeWriterBrand } from "@/components/layout/TreeWriterBrand";
import { WorkspaceModeMenu } from "@/components/layout/WorkspaceModeMenu";
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
  onExplorerModeChange,
  aiPanelOpen = false,
  onToggleAiPanel,
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
  onExplorerModeChange?: (explorer: boolean) => void;
  aiPanelOpen?: boolean;
  onToggleAiPanel?: () => void;
}) {
  const { active: readingFocusActive, extraChrome } = useReadingFocus();

  return (
    <header
      className={cn(
        "app-chrome-header flex h-11 items-center gap-2 border-b border-border bg-card px-2 shadow-sm sm:gap-3 sm:px-4",
        readingFocusActive ? "fixed inset-x-0 top-0 z-[60]" : "relative z-[60] shrink-0",
      )}
    >
      <div className="app-chrome-header__lead flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        {appView === "workspace" && onExplorerModeChange ? (
          <WorkspaceModeMenu explorerMode={explorerMode} onChange={onExplorerModeChange} />
        ) : (
          <TreeWriterBrand onHomeClick={onHomeClick} homeTitle={homeTitle} />
        )}
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
              <div className="editor-pane-toggle-host flex shrink-0 items-center">{extraChrome}</div>
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
                className="min-w-0 flex-1"
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

      {appView === "workspace" && !explorerMode ? (
        <WorkspaceChromeActions
          onRefreshModel={onRefreshModel}
          aiPanelOpen={aiPanelOpen}
          onToggleAiPanel={onToggleAiPanel}
        />
      ) : null}
    </header>
  );
}
