import { MoreHorizontal, RefreshCw, Sparkles, TerminalSquare, Wand2 } from "lucide-react";

import { ReadingFocusToggleButton } from "@/components/editor/ReadingFocusToggleButton";
import { Button } from "@/components/ui/button";
import { PopoverMenu, PopoverMenuItem } from "@/components/ui/PopoverMenu";

export function WorkspaceChromeActions({
  onRefreshModel,
  aiPanelOpen = false,
  onToggleAiPanel,
  onOpenTerminal,
  onOpenSkills,
}: {
  onRefreshModel: () => void;
  aiPanelOpen?: boolean;
  onToggleAiPanel?: () => void;
  onOpenTerminal?: () => void;
  onOpenSkills?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onToggleAiPanel ? (
        <Button
          type="button"
          variant={aiPanelOpen ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          title={aiPanelOpen ? "Close assistant panel" : "Open assistant panel"}
          aria-label={aiPanelOpen ? "Close assistant panel" : "Open assistant panel"}
          aria-pressed={aiPanelOpen}
          onClick={onToggleAiPanel}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      <ReadingFocusToggleButton variant="ghost" />
      <PopoverMenu
        align="end"
        aria-label="More actions"
        title="More actions"
        trigger={<MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
        triggerClassName="h-8 w-8 px-0"
      >
        {onOpenTerminal ? (
          <PopoverMenuItem onClick={onOpenTerminal}>
            <TerminalSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">Terminal</span>
          </PopoverMenuItem>
        ) : null}
        {onOpenSkills ? (
          <PopoverMenuItem onClick={onOpenSkills}>
            <Wand2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">Skills</span>
          </PopoverMenuItem>
        ) : null}
        <PopoverMenuItem onClick={onRefreshModel}>
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Refresh model</span>
        </PopoverMenuItem>
      </PopoverMenu>
    </div>
  );
}
