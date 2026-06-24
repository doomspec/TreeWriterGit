import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Highlighter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  TEXT_HIGHLIGHT_COLORS,
  type TextHighlightColorId,
} from "@/lib/textHighlight";

const STORAGE_KEY = "tw-highlight-color";

function readStoredHighlightColor(): TextHighlightColorId {
  if (typeof window === "undefined") return DEFAULT_HIGHLIGHT_COLOR;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return TEXT_HIGHLIGHT_COLORS.some((color) => color.id === stored)
    ? (stored as TextHighlightColorId)
    : DEFAULT_HIGHLIGHT_COLOR;
}

export function HighlightToolbarButton({
  disabled = false,
  onInsertHighlight,
}: {
  disabled?: boolean;
  onInsertHighlight?: (color: TextHighlightColorId) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [lastColor, setLastColor] = useState<TextHighlightColorId>(readStoredHighlightColor);

  const activeColor =
    TEXT_HIGHLIGHT_COLORS.find((color) => color.id === lastColor) ?? TEXT_HIGHLIGHT_COLORS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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
    const update = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = menu?.offsetWidth ?? 160;
      setPosition({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const selectColor = (colorId: TextHighlightColorId) => {
    setLastColor(colorId);
    window.localStorage.setItem(STORAGE_KEY, colorId);
    onInsertHighlight?.(colorId);
    setOpen(false);
  };

  return (
    <>
      <div className="inline-flex shrink-0 items-stretch rounded-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 rounded-r-none px-1.5"
          title={`Highlight selection (${activeColor.label})`}
          aria-label="Highlight selection"
          disabled={disabled || !onInsertHighlight}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsertHighlight?.(lastColor)}
        >
          <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />
          <span
            className={cn("h-2.5 w-2.5 rounded-sm", activeColor.swatchClassName)}
            aria-hidden="true"
          />
        </Button>
        <Button
          ref={buttonRef}
          type="button"
          variant={open ? "default" : "ghost"}
          size="sm"
          className="h-7 rounded-l-none border-l border-border/60 px-1.5"
          title="Choose highlight color"
          aria-label="Choose highlight color"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={disabled || !onInsertHighlight}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown
            className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </Button>
      </div>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Highlight colors"
              className="fixed z-overlay w-40 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg"
              style={{ top: position.top, left: position.left }}
            >
              <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Color
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {TEXT_HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={color.id === lastColor}
                    title={color.label}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md border border-border/60 transition hover:ring-2 hover:ring-primary/40",
                      color.swatchClassName,
                      color.id === lastColor && "ring-2 ring-primary",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectColor(color.id)}
                  >
                    <span className="sr-only">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
