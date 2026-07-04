import { CircleHelp, Monitor, Moon, Settings, Sun } from "lucide-react";

import type { AppView } from "@/components/commands/AppCommands";
import { SidebarRailHoverLabel } from "@/components/layout/SidebarRailHoverLabel";
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

function railButtonClass(showLabels: boolean): string {
  return showLabels ? "h-8 w-full justify-start gap-2 px-2" : "h-8 w-8 shrink-0 p-0";
}

/** Shared theme / guide / settings cluster for Writer and Explorer icon rails. */
export function SidebarRailFooter({
  showLabels = false,
  themePreference,
  appView,
  onCycleTheme,
  onSetAppView,
  className,
}: {
  showLabels?: boolean;
  themePreference: ThemePreference;
  appView: AppView;
  onCycleTheme: () => void;
  onSetAppView: (view: AppView) => void;
  className?: string;
}) {
  const ThemeIcon = THEME_ICONS[themePreference];

  const themeLabel = `${THEME_LABELS[themePreference]} — click to change`;

  return (
    <div className={cn("mt-auto flex shrink-0 flex-col items-stretch gap-1 border-t border-border py-1 px-0.5", className)}>
      <SidebarRailHoverLabel label={themeLabel} enabled={!showLabels}>
        <Button
          type="button"
          variant="ghost"
          size={showLabels ? "default" : "icon"}
          className={railButtonClass(showLabels)}
          title={showLabels ? themeLabel : undefined}
          aria-label={`Theme: ${themePreference}. Click to cycle.`}
          onClick={onCycleTheme}
        >
          <ThemeIcon className="sidebar-rail-icon" aria-hidden="true" />
          {showLabels ? <span className="truncate text-xs">{THEME_LABELS[themePreference]}</span> : null}
        </Button>
      </SidebarRailHoverLabel>
      <SidebarRailHoverLabel label="Guide & workspace status" enabled={!showLabels}>
        <Button
          type="button"
          variant={appView === "info" ? "default" : "ghost"}
          size={showLabels ? "default" : "icon"}
          className={railButtonClass(showLabels)}
          title={showLabels ? "Guide & workspace status" : undefined}
          aria-label="Guide and workspace status"
          aria-pressed={appView === "info"}
          onClick={() => onSetAppView(appView === "info" ? "workspace" : "info")}
        >
          <CircleHelp className="sidebar-rail-icon" aria-hidden="true" />
          {showLabels ? <span className="truncate text-xs">Guide</span> : null}
        </Button>
      </SidebarRailHoverLabel>
      <SidebarRailHoverLabel label="Settings" enabled={!showLabels}>
        <Button
          type="button"
          variant={appView === "settings" ? "default" : "ghost"}
          size={showLabels ? "default" : "icon"}
          className={railButtonClass(showLabels)}
          title={showLabels ? "Settings" : undefined}
          aria-label="Settings"
          aria-pressed={appView === "settings"}
          onClick={() => onSetAppView(appView === "settings" ? "workspace" : "settings")}
        >
          <Settings className="sidebar-rail-icon" aria-hidden="true" />
          {showLabels ? <span className="truncate text-xs">Settings</span> : null}
        </Button>
      </SidebarRailHoverLabel>
    </div>
  );
}
