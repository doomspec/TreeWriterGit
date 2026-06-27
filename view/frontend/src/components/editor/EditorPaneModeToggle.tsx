import { Eye, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EditorPaneMode } from "@/lib/editorSessionState";

export function EditorPaneModeToggle({
  paneMode,
  onPaneModeChange,
  ariaLabel,
  reviewMode = false,
}: {
  paneMode: EditorPaneMode;
  onPaneModeChange: (mode: EditorPaneMode) => void;
  ariaLabel: string;
  /** Rendered pane is showing pending track-changes review (read-only). */
  reviewMode?: boolean;
}) {
  return (
    <div
      className="inline-flex rounded-md border border-border p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      <Button
        type="button"
        variant={paneMode === "rendered" ? "default" : "ghost"}
        size="icon"
        className="h-6 w-6"
        aria-pressed={paneMode === "rendered"}
        title={reviewMode ? "Review changes (click text to edit)" : "Render"}
        aria-label={reviewMode ? "Review changes (click text to edit)" : "Render"}
        onClick={() => onPaneModeChange("rendered")}
      >
        <Eye className="h-3 w-3" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant={paneMode === "raw" ? "default" : "ghost"}
        size="icon"
        className="h-6 w-6"
        aria-pressed={paneMode === "raw"}
        title="Raw markdown"
        aria-label="Raw markdown"
        onClick={() => onPaneModeChange("raw")}
      >
        <FileCode2 className="h-3 w-3" aria-hidden="true" />
      </Button>
    </div>
  );
}
