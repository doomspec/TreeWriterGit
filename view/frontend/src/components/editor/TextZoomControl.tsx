import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EDITOR_TEXT_ZOOM_DEFAULT,
  EDITOR_TEXT_ZOOM_MAX,
  EDITOR_TEXT_ZOOM_MIN,
  formatEditorTextZoom,
} from "@/lib/editorTextZoom";
import { cn } from "@/lib/utils";

export function TextZoomControl({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}) {
  const atMin = zoom <= EDITOR_TEXT_ZOOM_MIN + 0.001;
  const atMax = zoom >= EDITOR_TEXT_ZOOM_MAX - 0.001;
  const atDefault = Math.abs(zoom - EDITOR_TEXT_ZOOM_DEFAULT) < 0.001;

  return (
    <div
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-border/70 p-0.5", className)}
      role="group"
      aria-label="Text size"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 px-0"
        title="Decrease text size (⌘−)"
        aria-label="Decrease text size"
        disabled={atMin}
        onClick={onZoomOut}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <span
        className="min-w-[2.75rem] px-1 text-center font-mono text-[10px] text-muted-foreground"
        aria-live="polite"
      >
        {formatEditorTextZoom(zoom)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 px-0"
        title="Increase text size (⌘+)"
        aria-label="Increase text size"
        disabled={atMax}
        onClick={onZoomIn}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      {!atDefault ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 px-0"
          title="Reset text size"
          aria-label="Reset text size"
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
