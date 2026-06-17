import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function ResizableSidebarLayout({
  sidebar,
  children,
  width,
  onWidthChange,
  minWidth = 180,
  maxWidth = 520,
  className,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = Math.min(maxWidth, Math.max(minWidth, Math.round(event.clientX - rect.left)));
      onWidthChange(next);
    },
    [maxWidth, minWidth, onWidthChange],
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
      className={cn("workspace-main min-h-0 flex-1", className)}
      style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}
    >
      <div className="workspace-main__sidebar min-h-0 min-w-0">{sidebar}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-label="Resize sidebar"
        tabIndex={0}
        className={cn(
          "workspace-main__handle resizable-dual-pane__handle",
          dragging && "resizable-dual-pane__handle--active",
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 24 : 12;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onWidthChange(Math.max(minWidth, width - step));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onWidthChange(Math.min(maxWidth, width + step));
          }
        }}
      />
      <div className="workspace-main__main min-h-0 min-w-0">{children}</div>
    </div>
  );
}

export function clampSidebarWidth(width: number, min = 180, max = 520): number {
  return Math.min(max, Math.max(min, Math.round(width)));
}
