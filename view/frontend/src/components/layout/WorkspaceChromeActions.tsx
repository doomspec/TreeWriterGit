import { RefreshCw } from "lucide-react";

import { ReadingFocusToggleButton } from "@/components/editor/ReadingFocusToggleButton";
import { Button } from "@/components/ui/button";

export function WorkspaceChromeActions({
  onRefreshModel,
}: {
  onRefreshModel: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
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
