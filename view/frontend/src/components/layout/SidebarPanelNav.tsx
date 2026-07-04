import type { AppView } from "@/components/commands/AppCommands";
import { SidebarRailHoverLabel } from "@/components/layout/SidebarRailHoverLabel";
import { Button } from "@/components/ui/button";
import { SIDEBAR_PANEL_NAV_ITEMS } from "@/lib/sidebarPanelNavItems";
import type { SidebarPanel } from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

function navButtonClass(showLabels: boolean): string {
  return showLabels
    ? "h-8 w-full justify-start gap-2 px-2"
    : "h-8 w-8 shrink-0 p-0";
}

/** Vertical panel switcher — icon column below the mode toggle. */
export function SidebarPanelNav({
  activePanel,
  panelOpen,
  graphAvailable,
  appView,
  showLabels = false,
  pendingReviewCount = 0,
  onSelectPanel,
  onSetAppView,
  className,
}: {
  activePanel: SidebarPanel;
  panelOpen: boolean;
  graphAvailable: boolean;
  appView: AppView;
  showLabels?: boolean;
  pendingReviewCount?: number;
  onSelectPanel: (panel: SidebarPanel) => void;
  onSetAppView: (view: AppView) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "sidebar-panel-nav flex min-h-0 flex-1 flex-col items-stretch gap-1 overflow-y-auto px-0.5 py-1",
        className,
      )}
      aria-label="Sidebar panels"
    >
      {SIDEBAR_PANEL_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        if (id === "graph" && !graphAvailable) return null;
        const active = appView === "workspace" && activePanel === id && panelOpen;
        const showBadge = id === "review" && pendingReviewCount > 0;
        const hoverLabel = showBadge ? `${label} (${pendingReviewCount})` : label;
        return (
          <SidebarRailHoverLabel key={id} label={hoverLabel} enabled={!showLabels}>
            <Button
              type="button"
              variant={active ? "default" : "ghost"}
              size={showLabels ? "default" : "icon"}
              className={navButtonClass(showLabels)}
              title={showLabels ? hoverLabel : undefined}
              aria-label={hoverLabel}
              aria-pressed={active}
              onClick={() => {
                onSetAppView("workspace");
                onSelectPanel(id);
              }}
            >
              <Icon className="sidebar-rail-icon" aria-hidden="true" />
              {showLabels ? <span className="min-w-0 flex-1 truncate text-left text-xs">{label}</span> : null}
              {showBadge ? (
                <span
                  className={cn(
                    "flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-semibold text-amber-950",
                    showLabels ? "shrink-0" : "absolute -right-0.5 -top-0.5",
                  )}
                >
                  {pendingReviewCount > 9 ? "9+" : pendingReviewCount}
                </span>
              ) : null}
            </Button>
          </SidebarRailHoverLabel>
        );
      })}
    </nav>
  );
}
