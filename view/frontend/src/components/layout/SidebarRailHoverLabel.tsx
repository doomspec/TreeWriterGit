import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/** Flyout label to the right of a sidebar rail icon (portal avoids overflow clipping). */
export function SidebarRailHoverLabel({
  label,
  enabled = true,
  className,
  children,
}: {
  label: string;
  enabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !enabled) {
      setPosition(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 6,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={anchorRef}
      className={cn("sidebar-rail-hover-label-anchor", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setVisible(false);
        }
      }}
    >
      {children}
      {visible && position
        ? createPortal(
            <span
              role="tooltip"
              className="sidebar-rail-hover-label pointer-events-none fixed z-overlay -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
              style={{ top: position.top, left: position.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}
