import { useEffect, useLayoutEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PopoverMenuCloseContext = createContext<(() => void) | null>(null);

export function PopoverMenu({
  trigger,
  children,
  align = "end",
  className,
  menuClassName,
  triggerClassName,
  disabled = false,
  "aria-label": ariaLabel = "Open menu",
}: {
  trigger: ReactNode | ((open: boolean) => ReactNode);
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  menuClassName?: string;
  triggerClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const updatePosition = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = menu?.offsetWidth ?? 220;
      const left =
        align === "end"
          ? Math.max(8, rect.right - menuWidth)
          : Math.min(window.innerWidth - menuWidth - 8, rect.left);
      setPosition({ top: rect.bottom + 6, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, open]);

  const triggerNode = typeof trigger === "function" ? trigger(open) : trigger;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", triggerClassName)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {triggerNode}
      </Button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className={cn(
                "fixed z-overlay min-w-[12rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
                menuClassName,
              )}
              style={{ top: position.top, left: position.left }}
            >
              <PopoverMenuCloseContext.Provider value={() => setOpen(false)}>
                {children}
              </PopoverMenuCloseContext.Provider>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function PopoverMenuSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="py-1">
      {label ? (
        <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function PopoverMenuItem({
  children,
  onClick,
  disabled = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const close = useContext(PopoverMenuCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
        className,
      )}
      onClick={() => {
        onClick?.();
        close?.();
      }}
    >
      {children}
    </button>
  );
}
