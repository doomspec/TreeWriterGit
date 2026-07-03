import { Bot, CircleHelp, Monitor, Moon, Settings, Sun } from "lucide-react";

import type { AppView } from "@/components/commands/AppCommands";
import { Button } from "@/components/ui/button";
import type { ThemePreference } from "@/lib/themePreferences";
import { cn } from "@/lib/utils";

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

/**
 * Narrow icon rail for Explorer mode — same width/style/icons as Writer's
 * SidebarIconRail bottom group (theme/info/settings), minus the panel
 * selector and pin/terminal/dispatch/git items that don't apply outside
 * the Writer workspace.
 */
export function ExplorerSidebarRail({
  themePreference,
  onCycleTheme,
  appView,
  onSetAppView,
  aiPanelOpen,
  onToggleAiPanel,
  className,
}: {
  themePreference: ThemePreference;
  onCycleTheme: () => void;
  appView: AppView;
  onSetAppView: (view: AppView) => void;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
  className?: string;
}) {
  const ThemeIcon = THEME_ICONS[themePreference];

  return (
    <aside
      className={cn(
        "sidebar-icon-rail flex min-h-0 w-9 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))]",
        className,
      )}
      aria-label="Explorer sidebar navigation"
    >
      <div
        className="flex h-[var(--workspace-pane-header-height,2.25rem)] shrink-0 items-center justify-center border-b border-border">
        <Button
          type="button"
          variant={aiPanelOpen ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7"
          title={aiPanelOpen ? "Close AI assistant" : "Open AI assistant"}
          aria-label={aiPanelOpen ? "Close AI assistant" : "Open AI assistant"}
          aria-pressed={aiPanelOpen}
          onClick={onToggleAiPanel}
        >
          <Bot className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="min-h-0 flex-1" />
      <div className="mt-auto flex shrink-0 flex-col items-center gap-1 border-t border-border py-1">
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
      </div>
    </aside>
  );
}
