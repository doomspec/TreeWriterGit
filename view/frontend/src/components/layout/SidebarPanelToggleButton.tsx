import { PanelLeft, PanelLeftClose, Pin } from "lucide-react";

import { SidebarRailHoverLabel } from "@/components/layout/SidebarRailHoverLabel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SidebarPanelLayoutMode = "collapsed" | "expanded" | "pinned";

export function resolveSidebarPanelLayoutMode(
  panelOpen: boolean,
  pinned: boolean,
): SidebarPanelLayoutMode {
  if (!panelOpen) return "collapsed";
  if (pinned) return "pinned";
  return "expanded";
}

const MODE_LABEL: Record<SidebarPanelLayoutMode, string> = {
  collapsed: "Expand sidebar panel",
  expanded: "Pin sidebar panel",
  pinned: "Collapse sidebar panel",
};

/** Top-of-rail control cycling collapsed → expanded overlay → pinned. */
export function SidebarPanelToggleButton({
  panelOpen,
  pinned,
  onCycle,
  showLabels = false,
  className,
}: {
  panelOpen: boolean;
  pinned: boolean;
  onCycle: () => void;
  showLabels?: boolean;
  className?: string;
}) {
  const mode = resolveSidebarPanelLayoutMode(panelOpen, pinned);
  const label = MODE_LABEL[mode];

  return (
    <SidebarRailHoverLabel
      label={label}
      enabled={!showLabels}
      className={cn("sidebar-panel-toggle flex shrink-0 justify-center px-0.5 py-1", className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          showLabels ? "h-8 w-full justify-start gap-2 px-2" : "sidebar-rail-btn",
          mode === "pinned" && "bg-accent text-accent-foreground hover:bg-accent/90",
        )}
        title={showLabels ? label : undefined}
        aria-label={label}
        aria-pressed={mode !== "collapsed"}
        data-sidebar-layout-mode={mode}
        onClick={onCycle}
      >
        {mode === "collapsed" ? (
          <PanelLeft className="sidebar-rail-icon" aria-hidden="true" />
        ) : mode === "expanded" ? (
          <PanelLeftClose className="sidebar-rail-icon" aria-hidden="true" />
        ) : (
          <Pin className="sidebar-rail-icon" aria-hidden="true" />
        )}
        {showLabels ? (
          <span className="min-w-0 flex-1 truncate text-left text-xs">{label}</span>
        ) : null}
      </Button>
    </SidebarRailHoverLabel>
  );
}
