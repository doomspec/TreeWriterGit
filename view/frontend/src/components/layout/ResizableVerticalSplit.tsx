import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ResizableVerticalSplitProps = {
  top: React.ReactNode;
  bottom: React.ReactNode;
  splitPercent: number;
  onSplitChange: (percent: number) => void;
  className?: string;
  minPercent?: number;
  maxPercent?: number;
  handleLabel?: string;
};

export function ResizableVerticalSplit({
  top,
  bottom,
  splitPercent,
  onSplitChange,
  className,
  minPercent = 25,
  maxPercent = 80,
  handleLabel = "Resize editor and preview",
}: ResizableVerticalSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = (event.clientY - rect.top) / rect.height;
      const percent = Math.min(maxPercent, Math.max(minPercent, Math.round(ratio * 100)));
      onSplitChange(percent);
    },
    [maxPercent, minPercent, onSplitChange],
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

  return (
    <div
      ref={containerRef}
      className={cn("resizable-vertical-split min-h-0 flex-1", className)}
      style={
        {
          "--vertical-split": `${splitPercent}%`,
        } as React.CSSProperties
      }
    >
      <div className="resizable-vertical-split__top editor-pane min-h-0">{top}</div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={splitPercent}
        aria-valuemin={minPercent}
        aria-valuemax={maxPercent}
        aria-label={handleLabel}
        tabIndex={0}
        className={cn(
          "resizable-vertical-split__handle resizable-dual-pane__handle",
          dragging && "resizable-dual-pane__handle--active",
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 5;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onSplitChange(Math.max(minPercent, splitPercent - step));
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onSplitChange(Math.min(maxPercent, splitPercent + step));
          }
        }}
      />
      <div className="resizable-vertical-split__bottom editor-pane min-h-0">{bottom}</div>
    </div>
  );
}
