import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ResizableDualPaneProps = {
  left: React.ReactNode;
  right: React.ReactNode;
  splitPercent: number;
  onSplitChange: (percent: number) => void;
  className?: string;
  minPercent?: number;
  maxPercent?: number;
};

export function ResizableDualPane({
  left,
  right,
  splitPercent,
  onSplitChange,
  className,
  minPercent = 20,
  maxPercent = 80,
}: ResizableDualPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const horizontal = rect.width >= 900;
      const ratio = horizontal
        ? (event.clientX - rect.left) / rect.width
        : (event.clientY - rect.top) / rect.height;
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
      className={cn("resizable-dual-pane min-h-0 flex-1", className)}
      style={
        {
          "--dual-pane-split": `${splitPercent}%`,
        } as React.CSSProperties
      }
    >
      <div className="resizable-dual-pane__left min-h-0">{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={splitPercent}
        aria-valuemin={minPercent}
        aria-valuemax={maxPercent}
        tabIndex={0}
        className={cn(
          "resizable-dual-pane__handle",
          dragging && "resizable-dual-pane__handle--active",
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 5;
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            onSplitChange(Math.max(minPercent, splitPercent - step));
          }
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            onSplitChange(Math.min(maxPercent, splitPercent + step));
          }
        }}
      />
      <div className="resizable-dual-pane__right min-h-0">{right}</div>
    </div>
  );
}
