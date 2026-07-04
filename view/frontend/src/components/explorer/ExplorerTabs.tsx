import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

function basename(path: string): string {
  return path.split("/").pop() || path;
}

const tabRowClass =
  "flex h-[var(--workspace-pane-header-height,2.25rem)] shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs whitespace-nowrap";

const menuRowClass =
  "flex h-7 shrink-0 cursor-pointer items-center gap-1 border-b border-border px-2 text-[11px] leading-tight whitespace-nowrap last:border-b-0";

const TAB_MENU_WIDTH_PX = 192;

/** Chrome-style tab strip for the files open in Explorer mode. */
export function ExplorerTabs({
  tabs,
  activeTab,
  onSelect,
  onClose,
  onCloseAll,
}: {
  tabs: string[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseAll: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!activeTab) return;
    tabRefs.current.get(activeTab)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab, tabs]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById("explorer-tabs-menu");
      if (menu?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuFrame(null);
      return;
    }
    const updateFrame = () => {
      const barRect = rootRef.current?.getBoundingClientRect();
      const triggerRect = menuTriggerRef.current?.getBoundingClientRect();
      if (!barRect || !triggerRect) return;
      const left = Math.max(8, triggerRect.right - TAB_MENU_WIDTH_PX);
      setMenuFrame({ top: barRect.bottom, left, width: TAB_MENU_WIDTH_PX });
    };
    updateFrame();
    window.addEventListener("resize", updateFrame);
    window.addEventListener("scroll", updateFrame, true);
    return () => {
      window.removeEventListener("resize", updateFrame);
      window.removeEventListener("scroll", updateFrame, true);
    };
  }, [menuOpen, tabs.length]);

  if (tabs.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="explorer-tabs relative flex w-full h-[var(--workspace-pane-header-height,2.25rem)] shrink-0 items-stretch border-b border-border bg-[hsl(var(--sidebar-bg))]"
    >
      <div
        ref={stripRef}
        role="tablist"
        className="explorer-tabs__strip flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden pr-7"
      >
        {tabs.map((path) => {
          const active = path === activeTab;
          return (
            <div
              key={path}
              ref={(element) => {
                if (element) tabRefs.current.set(path, element);
                else tabRefs.current.delete(path);
              }}
              role="tab"
              aria-selected={active}
              title={path}
              onClick={() => onSelect(path)}
              className={cn(
                "group",
                tabRowClass,
                active
                  ? "bg-background text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/40",
              )}
            >
              <span>{basename(path)}</span>
              <button
                type="button"
                aria-label={`Close ${basename(path)}`}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted",
                  active ? "opacity-70" : "opacity-0 group-hover:opacity-70",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(path);
                }}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-y-0 right-0 flex shrink-0 items-stretch border-l border-border bg-[hsl(var(--sidebar-bg))]">
        <button
          ref={menuTriggerRef}
          type="button"
          title="All open tabs"
          aria-label="All open tabs"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className={cn(
            "flex h-full w-7 shrink-0 items-center justify-center transition-colors",
            menuOpen
              ? "bg-primary/16 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.24)]"
              : "bg-primary/10 text-primary hover:bg-primary/16",
          )}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {menuOpen && menuFrame
        ? createPortal(
            <div
              id="explorer-tabs-menu"
              role="menu"
              aria-label={`Open tabs (${tabs.length})`}
              className="explorer-theme explorer-tabs__menu fixed z-[90] min-w-[12rem] max-h-[min(16rem,calc(100vh-12rem))] overflow-y-auto border border-t-0 border-border bg-card"
              style={{ top: menuFrame.top, left: menuFrame.left, width: menuFrame.width }}
            >
              {tabs.map((path) => {
                const active = path === activeTab;
                return (
                  <button
                    key={path}
                    type="button"
                    role="menuitem"
                    title={path}
                    className={cn(
                      "w-full text-left",
                      menuRowClass,
                      active
                        ? "bg-background text-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-accent/40",
                    )}
                    onClick={() => {
                      onSelect(path);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{basename(path)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                role="menuitem"
                className={cn(
                  "w-full text-left text-primary hover:bg-primary/10 hover:text-primary",
                  menuRowClass,
                )}
                onClick={() => {
                  onCloseAll();
                  setMenuOpen(false);
                }}
              >
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Close all tabs</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
