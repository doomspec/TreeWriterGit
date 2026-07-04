import { useCallback, useEffect, useRef, useState } from "react";

import {
  AI_PANEL_WIDTH_MAX,
  AI_PANEL_WIDTH_MIN,
  clampAiPanelWidth,
} from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

/** Minimum main-column width before the assistant panel stacks as an overlay. */
const MIN_MAIN_COLUMN_PX = 320;
const NARROW_SPLIT_THRESHOLD = AI_PANEL_WIDTH_MIN + MIN_MAIN_COLUMN_PX + 8;

/**
 * Horizontal split hosting the main editor column on the left and the AI
 * assistant panel on the right, with a keyboard-accessible drag handle.
 * When closed, children render full-width with zero overhead.
 * On narrow viewports the panel becomes a fixed overlay so the editor keeps room.
 */
export function AiAssistantSplit({
  open,
  width,
  onWidthChange,
  panel,
  children,
}: {
  open: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  panel: React.ReactNode;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [overlayMode, setOverlayMode] = useState(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      onWidthChange(clampAiPanelWidth(rect.right - event.clientX));
    },
    [onWidthChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [dragging, onPointerMove]);

  useEffect(() => {
    if (!open) {
      setOverlayMode(false);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const available = el.clientWidth;
      setOverlayMode(available < NARROW_SPLIT_THRESHOLD);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  if (!open) {
    return <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
  }

  if (overlayMode) {
    const overlayWidth = Math.min(width, AI_PANEL_WIDTH_MAX);
    return (
      <div ref={containerRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        <div
          className="absolute inset-y-0 right-0 z-40 flex min-h-0 flex-col border-l border-border bg-card shadow-lg"
          style={{ width: overlayWidth }}
        >
          {panel}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize assistant panel"
        aria-valuenow={width}
        aria-valuemin={AI_PANEL_WIDTH_MIN}
        aria-valuemax={AI_PANEL_WIDTH_MAX}
        tabIndex={0}
        className={cn(
          "w-1 shrink-0 cursor-col-resize bg-border/60 transition-colors hover:bg-primary/50",
          dragging && "bg-primary",
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 40 : 16;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onWidthChange(clampAiPanelWidth(width + step));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onWidthChange(clampAiPanelWidth(width - step));
          }
        }}
      />
      <div className="flex min-h-0 shrink-0 flex-col" style={{ width }}>
        {panel}
      </div>
    </div>
  );
}
