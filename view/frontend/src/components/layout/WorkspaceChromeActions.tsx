import { RefreshCw, Sparkles } from "lucide-react";

import { ReadingFocusToggleButton } from "@/components/editor/ReadingFocusToggleButton";
import { Button } from "@/components/ui/button";

export function WorkspaceChromeActions({
  onRefreshModel,
  aiPanelOpen = false,
  onToggleAiPanel,
}: {
  onRefreshModel: () => void;
  aiPanelOpen?: boolean;
  onToggleAiPanel?: () => void;
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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Refresh model"
        aria-label="Refresh model"
        onClick={onRefreshModel}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </Button>
      <ReadingFocusToggleButton variant="ghost" />
    </div>
  );
}
