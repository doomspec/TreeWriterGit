import {
  Bot,
  CircleHelp,
  Download,
  FileStack,
  FileUp,
  FolderTree,
  GitBranch,
  GitCompare,
  ListTree,
  Monitor,
  Moon,
  Network,
  PanelLeft,
  PanelLeftClose,
  Pin,
  PinOff,
  Settings,
  Sun,
  TerminalSquare,
} from "lucide-react";

import type { AppView } from "@/components/commands/AppCommands";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatGitSyncError, gitSyncHasError, type GitSyncState } from "@/lib/gitSync";
import type { ThemePreference } from "@/lib/themePreferences";
import type { SidebarPanel } from "@/lib/workspacePreferences";

function gitSyncRailIconClass(gitSync: GitSyncState | null): string {
  if (gitSync?.conflictDetected) return "text-destructive";
  if (gitSync?.lastError) return "text-[hsl(var(--warning))]";
  if (gitSync?.running) return "text-[hsl(var(--warning))]";
  if (gitSync?.enabled) return "text-[hsl(var(--success))]";
  return "text-muted-foreground";
}

const THEME_ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light mode",
  dark: "Dark mode",
  system: "System theme",
};

const RAIL_ITEMS: {
  id: SidebarPanel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "explorer", label: "Explorer", icon: FolderTree },
  { id: "papers", label: "Papers", icon: FileStack },
  { id: "graph", label: "Graph", icon: Network },
  { id: "outline", label: "Document outline", icon: ListTree },
  { id: "review", label: "Review changes", icon: GitCompare },
  { id: "import", label: "Import from Word", icon: FileUp },
  { id: "export", label: "Export & Overleaf", icon: Download },
];

export function SidebarIconRail({
  activePanel,
  panelOpen,
  pinned,
  graphAvailable,
  agentPanelOpen,
  agentPanelFocus,
  appView,
  gitSync,
  gitStatusLabel,
  connectionState,
  themePreference,
  onSelectPanel,
  onTogglePanel,
  onTogglePin,
  onOpenTerminalPanel,
  onOpenDispatchPanel,
  onGitClick,
  onSetAppView,
  onCycleTheme,
  onPointerEnter,
  onPointerLeave,
  pendingReviewCount = 0,
  className,
}: {
  activePanel: SidebarPanel;
  panelOpen: boolean;
  pinned: boolean;
  graphAvailable: boolean;
  agentPanelOpen: boolean;
  agentPanelFocus: "terminal" | "dispatch" | null;
  appView: AppView;
  gitSync: GitSyncState | null;
  gitStatusLabel: string;
  connectionState: string;
  themePreference: ThemePreference;
  onSelectPanel: (panel: SidebarPanel) => void;
  onTogglePanel: () => void;
  onTogglePin: () => void;
  onOpenTerminalPanel: () => void;
  onOpenDispatchPanel: () => void;
  onGitClick: () => void;
  onSetAppView: (view: AppView) => void;
  onCycleTheme: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  pendingReviewCount?: number;
  className?: string;
}) {
  const gitTitle =
    gitSync && gitSyncHasError(gitSync)
      ? formatGitSyncError(gitSync)
      : gitSync?.enabled
        ? `Git: ${gitStatusLabel} (click to sync)`
        : "Git sync disabled";

  const ThemeIcon = THEME_ICONS[themePreference];

  return (
    <aside
      className={cn(
        "sidebar-icon-rail flex min-h-0 w-9 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))]",
        className,
      )}
      aria-label="Sidebar navigation"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="flex h-[var(--workspace-pane-header-height,2.25rem)] shrink-0 items-center justify-center border-b border-border">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", gitSyncRailIconClass(gitSync))}
          title={gitTitle}
          aria-label={gitTitle}
          disabled={!gitSync?.enabled || gitSync?.running}
          onClick={onGitClick}
        >
          <GitBranch className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-1">
        {RAIL_ITEMS.map(({ id, label, icon: Icon }) => {
        if (id === "graph" && !graphAvailable) return null;
        const active = appView === "workspace" && activePanel === id && panelOpen;
        const showBadge = id === "review" && pendingReviewCount > 0;
        return (
          <Button
            key={id}
            type="button"
            variant={active ? "default" : "ghost"}
            size="icon"
            className="relative h-8 w-8"
            title={showBadge ? `${label} (${pendingReviewCount})` : label}
            aria-label={showBadge ? `${label} (${pendingReviewCount})` : label}
            aria-pressed={active}
            onClick={() => {
              onSetAppView("workspace");
              onSelectPanel(id);
            }}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {showBadge ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-semibold text-amber-950">
                {pendingReviewCount > 9 ? "9+" : pendingReviewCount}
              </span>
            ) : null}
          </Button>
        );
      })}
      </div>

      <div className="mt-auto flex shrink-0 flex-col items-center gap-1 border-t border-border py-1">
        {!agentPanelOpen ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={`Terminal (${connectionState})`}
              aria-label={`Terminal (${connectionState})`}
              onClick={onOpenTerminalPanel}
            >
              <TerminalSquare className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="AI dispatch"
              aria-label="AI dispatch"
              onClick={onOpenDispatchPanel}
            >
              <Bot className="h-4 w-4" aria-hidden="true" />
            </Button>

            <div className="my-0.5 h-px w-6 bg-border" aria-hidden="true" />
          </>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={`${THEME_LABELS[themePreference]} — click to change`}
          aria-label={`Theme: ${themePreference}. Click to cycle.`}
          onClick={onCycleTheme}
        >
          <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant={appView === "info" ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          title="Guide & workspace status"
          aria-label="Guide and workspace status"
          aria-pressed={appView === "info"}
          onClick={() => onSetAppView(appView === "info" ? "workspace" : "info")}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant={appView === "settings" ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          title="Settings"
          aria-label="Settings"
          aria-pressed={appView === "settings"}
          onClick={() => onSetAppView(appView === "settings" ? "workspace" : "settings")}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant={pinned ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          title={pinned ? "Unpin sidebar (show on hover)" : "Pin sidebar open"}
          aria-label={pinned ? "Unpin sidebar panel" : "Pin sidebar panel open"}
          aria-pressed={pinned}
          onClick={onTogglePin}
        >
          {pinned ? (
            <Pin className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PinOff className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={panelOpen ? "Collapse sidebar panel" : "Expand sidebar panel"}
          aria-label={panelOpen ? "Collapse sidebar panel" : "Expand sidebar panel"}
          aria-pressed={panelOpen}
          onClick={onTogglePanel}
        >
          {panelOpen ? (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </aside>
  );
}
